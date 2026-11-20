import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as WebIFC from "web-ifc";
import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage/index.js";
import { mm } from "../src/model/index.js";
import { ifcGuid } from "../src/ifc/guid.js";
import { ifcGeometry, roundTripChecks } from "../src/ifc/roundtrip.js";
import { validateIfc } from "../src/ifc/validate.js";
import { writeIfc } from "../src/ifc/writer.js";
import { BuildingModelSchema, type BuildingModel } from "../src/schema/schema.js";
import { splayedCottage } from "./support/reveal.js";

const model = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
const text = async (m: BuildingModel) => new TextDecoder().decode(await writeIfc(m, { fileName: "t.ifc" }));
const ids = (api: WebIFC.IfcAPI, model: number, type: number): number[] => {
  const v = api.GetLineIDsWithType(model, type);
  return Array.from({ length: v.size() }, (_, i) => v.get(i));
};
const globalIds = (ifc: string) => [...ifc.matchAll(/^#\d+=IFC\w+\('([0-9A-Za-z_$]{22})'/gm)].map((m) => m[1]);

describe("IFC writer", () => {
  it("is byte-identical across runs", async () => {
    expect(await text(model)).toBe(await text(model));
  });

  it("derives element GlobalIds from element ids", async () => {
    const ifc = await text(model);
    for (const id of ["wall-south", "door-front", "window-bathroom", "slab-ground", "room-hall", "storey-ground"]) {
      expect(ifc).toContain(`('${ifcGuid(id)}'`);
    }
  });

  it("gives every IfcRoot a unique GlobalId", async () => {
    const ids = globalIds(await text(model));
    expect(ids.length).toBeGreaterThan(50);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("writes components as door and window types, declared in the project and linked to their openings", async () => {
    const api = new WebIFC.IfcAPI();
    await api.Init();
    const id = api.OpenModel(await writeIfc(model, { fileName: "t.ifc" }));
    try {
      const tag = (e: number) => api.GetLine(id, e).Tag?.value as string;
      const typeOf = new Map<string, string>();
      for (const rel of ids(api, id, WebIFC.IFCRELDEFINESBYTYPE)) {
        const r = api.GetLine(id, rel);
        for (const o of r.RelatedObjects) typeOf.set(tag(o.value), tag(r.RelatingType.value));
      }
      expect(Object.fromEntries(typeOf)).toEqual({
        "door-front": "door-type-external",
        "door-back": "door-type-external",
        "door-living": "door-type-internal",
        "door-kitchen": "door-type-internal",
        "door-bedroom": "door-type-internal",
        "door-bathroom": "door-type-internal",
        "window-living": "window-type-sash",
        "window-bedroom": "window-type-sash",
        "window-kitchen": "window-type-sash",
        "window-bathroom": "window-type-sash",
      });
      expect(ids(api, id, WebIFC.IFCDOORTYPE).map(tag).sort()).toEqual(["door-type-external", "door-type-internal"]);
      expect(ids(api, id, WebIFC.IFCWINDOWTYPE).map(tag)).toEqual(["window-type-sash"]);
      const [declares] = ids(api, id, WebIFC.IFCRELDECLARES).map((e) => api.GetLine(id, e));
      expect(declares.RelatedDefinitions).toHaveLength(3);
      expect(api.GetLine(id, declares.RelatingContext.value).constructor.name).toBe("IfcProject");
    } finally {
      api.CloseModel(id);
    }
  });

  it("maps the glazing grid to IFC4 partitioning values on the type and its instances", async () => {
    const read = async (m: BuildingModel) => {
      const api = new WebIFC.IfcAPI();
      await api.Init();
      const id = api.OpenModel(await writeIfc(m, { fileName: "t.ifc" }));
      try {
        const lines = (type: number) => ids(api, id, type).map((e) => api.GetLine(id, e));
        const value = (v: { value?: string } | string | null) => (typeof v === "string" ? v : (v?.value ?? null));
        return {
          types: lines(WebIFC.IFCWINDOWTYPE).map((t) => [value(t.PartitioningType), value(t.UserDefinedPartitioningType)]),
          instances: lines(WebIFC.IFCWINDOW).map((w) => [value(w.PartitioningType), value(w.UserDefinedPartitioningType)]),
        };
      } finally {
        api.CloseModel(id);
      }
    };
    const withGlazing = (columns: number[], rows: number[]) => {
      const m = structuredClone(model);
      m.components!.windows[0]!.glazing = { columns, rows, barWidth: mm(60) };
      return m;
    };

    expect(await read(model)).toEqual({
      types: [["SINGLE_PANEL", null]],
      instances: Array(4).fill(["SINGLE_PANEL", null]),
    });
    expect(await read(withGlazing([1, 1], [1]))).toEqual({
      types: [["DOUBLE_PANEL_VERTICAL", null]],
      instances: Array(4).fill(["DOUBLE_PANEL_VERTICAL", null]),
    });
    expect(await read(withGlazing([1, 2, 1], [1, 1]))).toEqual({
      types: [["USERDEFINED", "3x2 grid"]],
      instances: Array(4).fill(["USERDEFINED", "3x2 grid"]),
    });
  });

  it("keeps GlobalIds stable when geometry changes", async () => {
    const thicker = structuredClone(model);
    thicker.storeys[0]!.walls[0]!.thickness = 300 as never;
    const [a, b] = [await text(model), await text(thicker)];
    expect(a).not.toBe(b);
    expect(globalIds(b)).toEqual(globalIds(a));
  });

  it("produces geometry whose volumes match the model, with openings cut", async () => {
    const ifc = await writeIfc(model, { fileName: "t.ifc" });
    expect(await roundTripChecks(model, ifc)).toEqual([]);
    const south = (await ifcGeometry(ifc)).get("wall-south")!;
    expect(south.volume / 1e9).toBeCloseTo(3.84 - 0.378 - 2 * 0.288, 6);
  });

  describe("a splayed reveal", () => {
    const splayed = splayedCottage();
    const openingProfile = (ifc: string, id: string) => {
      // The opening's shape: the profile its body extrudes, found through the IfcOpeningElement's representation.
      const lines = new Map([...ifc.matchAll(/^#(\d+)=(.*);$/gm)].map((m) => [m[1]!, m[2]!]));
      const refs = (line: string) => [...line.matchAll(/#(\d+)/g)].map((m) => m[1]!);
      const opening = [...lines.values()].find((l) => l.startsWith("IFCOPENINGELEMENT(") && l.includes(`'${id} opening'`))!;
      let frontier = refs(opening);
      for (let depth = 0; depth < 6; depth++) {
        const profile = frontier.map((r) => lines.get(r)!).find((l) => /^IFC(ARBITRARYCLOSED|RECTANGLE)PROFILEDEF\(/.test(l));
        if (profile) return { profile, lines, refs };
        frontier = frontier.flatMap((r) => refs(lines.get(r) ?? ""));
      }
      throw new Error(`no profile for ${id}`);
    };

    it("voids the wall with the outline, square on one side and splayed on the other, 10 mm past each face", async () => {
      const ifc = await text(splayed);
      const { profile, lines, refs } = openingProfile(ifc, "window-living");
      expect(profile).toMatch(/^IFCARBITRARYCLOSEDPROFILEDEF\(/);
      const polyline = lines.get(refs(profile)[0]!)!;
      const points = refs(polyline).map((r) => lines.get(r)!.match(/\(([-\d.E]+),([-\d.E]+)\)/)!.slice(1).map(Number));
      // Opening-local x from its near jamb; y across the left-justified 200 mm wall, inside (left) at 200.
      expect(points).toEqual([[0, -10], [1200, -10], [1200, 100], [1310, 210], [-110, 210], [0, 100], [0, -10]]);
    });

    it("keeps a rectangle for windows without a reveal", async () => {
      const ifc = await text(splayed);
      expect(openingProfile(ifc, "window-bedroom").profile).toMatch(/^IFCRECTANGLEPROFILEDEF\(/);
    });

    it("cuts the splayed volume from the wall, as the round-trip expects", async () => {
      const ifc = await writeIfc(splayed, { fileName: "t.ifc" });
      expect(await roundTripChecks(splayed, ifc)).toEqual([]);
      // The living-room window cuts 1.2 × 0.2 × 1.2 m plus two 0.1 × 0.1 / 2 m triangles up its 1.2 m.
      const south = (await ifcGeometry(ifc)).get("wall-south")!;
      expect(south.volume / 1e9).toBeCloseTo(3.84 - 0.378 - 2 * 0.288 - 0.012, 6);
    });

    it("reports the wall when the IFC void is square but the model is splayed", async () => {
      const square = await writeIfc(model, { fileName: "t.ifc" }); // the same cottage, unsplayed
      const issues = await roundTripChecks(splayed, square);
      expect(issues.map((i) => i.id)).toEqual(["wall-south"]);
      expect(issues[0]!.message).toMatch(/wall \(after opening cuts\) volume/);
    });
  });
});

describe("IfcOpenShell validator", () => {
  const dir = mkdtempSync(join(tmpdir(), "elmstead-"));

  it("passes the cottage with no errors or warnings", async () => {
    const path = join(dir, "ok.ifc");
    writeFileSync(path, await writeIfc(model, { fileName: "ok.ifc" }));
    const v = validateIfc(path);
    expect(v.issues).toEqual([]);
    expect([v.errors, v.warnings]).toEqual([0, 0]);
  }, 60_000);

  it("passes a splayed reveal with no errors or warnings", async () => {
    const path = join(dir, "splayed.ifc");
    writeFileSync(path, await writeIfc(splayedCottage(), { fileName: "splayed.ifc" }));
    const v = validateIfc(path);
    expect(v.issues).toEqual([]);
    expect([v.errors, v.warnings]).toEqual([0, 0]);
  }, 60_000);

  it("reports broken files one line per problem, attributed to our element id", async () => {
    const good = new TextDecoder().decode(await writeIfc(model, { fileName: "bad.ifc" }));
    const bad = good
      .replace(/(IFCDOOR\('[^']+',\$,'door-front'.*?)\.SINGLE_SWING_\w+\./, "$1.BOGUS.")
      .replace(/(IFCEXTRUDEDAREASOLID\(#\d+,\$,#\d+,)2400\./, "$1-2400.");
    const path = join(dir, "bad.ifc");
    writeFileSync(path, bad);
    const v = validateIfc(path);
    expect(v.errors).toBe(2);
    expect(v.issues.map((i) => i.id).sort()).toEqual(["door-front", "wall-south"]);
    expect(v.issues.find((i) => i.id === "wall-south")!.message).toMatch(/WR1/);
  }, 60_000);
});
