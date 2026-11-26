import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as WebIFC from "web-ifc";
import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import { m, mm, pt, railing, wall as makeWall } from "../src/model/index.js";
import { ifcGuid } from "../src/ifc/guid.js";
import { STYLES } from "../src/ifc/styles.js";
import { railingGeometry } from "../src/geometry/railing.js";
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

  it("styles a ground slab with the ground colour and leaves concrete slabs as before", async () => {
    const ground = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
    ground.storeys[0]!.slabs[0]!.material = "ground";
    const groundIfc = await text(ground);
    const style = /#(\d+)=IFCSURFACESTYLE\('ground'/.exec(groundIfc)![1];
    const styled = groundIfc.match(new RegExp(`IFCSTYLEDITEM\\(#\\d+,\\(#${style}\\)`, "g")) ?? [];
    expect(styled).toHaveLength(1);

    const concreteIfc = await text(model);
    expect(concreteIfc).not.toMatch(/IFCSURFACESTYLE\('ground'/);
    expect(concreteIfc).toMatch(/IFCSURFACESTYLE\('slab'/);
  });

  it("keeps the ground colour far enough from every other style for the viewer to recognise it", () => {
    const toLinear = (c: number) => (c < 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const ground = STYLES.ground.rgb.map(toLinear);
    for (const [name, { rgb }] of Object.entries(STYLES)) {
      if (name === "ground") continue;
      const d = Math.hypot(...rgb.map((c, i) => toLinear(c) - ground[i]!));
      expect(d, name).toBeGreaterThanOrEqual(0.02);
    }
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

describe("a pitched wall", () => {
  const gable = () => {
    const m = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
    m.storeys[0]!.walls = [makeWall("wall-gable", pt(mm(0), mm(0)), pt(mm(4000), mm(0)), {
      thickness: mm(200),
      profile: [{ along: mm(0), up: mm(1200) }, { along: mm(2000), up: mm(2600) }, { along: mm(4000), up: mm(1200) }],
      justification: "left",
    })];
    m.storeys[0]!.openings = [];
    return m;
  };

  it("meshes the gable and round-trips its profile area × thickness", async () => {
    const m = gable();
    const ifc = await writeIfc(m, { fileName: "t.ifc" });
    expect(await roundTripChecks(m, ifc)).toEqual([]);
    const geom = await ifcGeometry(ifc);
    // Side area = 4000×1200 + (2600−1200)×4000/2 = 7.6e6 mm²; × 200 mm = 1.52 m³.
    expect(geom.get("wall-gable")!.volume / 1e9).toBeCloseTo(1.52, 6);
  });
});

describe("a stair in IFC", () => {
  const stairModel = BuildingModelSchema.parse(JSON.parse(JSON.stringify(twoStorey)));
  const stair = stairModel.storeys[0]!.stairs![0]!;
  const write = (m: BuildingModel) => writeIfc(m, { fileName: "stair.ifc" });
  const enumValue = (v: unknown) => (typeof v === "string" ? v : ((v as { value?: string } | null)?.value ?? null));

  /** Open the written IFC and read every line of one entity type. */
  async function lines(ifc: Uint8Array, type: number) {
    const api = new WebIFC.IfcAPI();
    await api.Init();
    const id = api.OpenModel(ifc);
    try {
      return ids(api, id, type).map((e) => api.GetLine(id, e));
    } finally {
      api.CloseModel(id);
    }
  }

  it("writes the stair as a bodyless IfcStair container typed by its flights' turn", async () => {
    const [container] = await lines(await write(stairModel), WebIFC.IFCSTAIR);
    expect(container!.Tag.value).toBe("stair-main");
    expect(enumValue(container!.PredefinedType)).toBe("HALF_TURN_STAIR");
    expect(container!.Representation).toBeNull();
  });

  it("types a straight stair and an odd angle", async () => {
    const straight = structuredClone(stairModel);
    straight.storeys[0]!.stairs![0]!.segments = [structuredClone(stair.segments[0]!)];
    expect(enumValue((await lines(await write(straight), WebIFC.IFCSTAIR))[0]!.PredefinedType)).toBe("STRAIGHT_RUN_STAIR");

    const odd = structuredClone(stairModel);
    const upper = odd.storeys[0]!.stairs![0]!.segments[2]!;
    if (upper.kind === "flight") upper.end = { x: upper.start.x - 1800, y: upper.start.y + 1800 } as never; // 135° turn
    expect(enumValue((await lines(await write(odd), WebIFC.IFCSTAIR))[0]!.PredefinedType)).toBe("NOTDEFINED");
  });

  it("writes each flight with the IFC4 riser and tread attributes", async () => {
    const flights = await lines(await write(stairModel), WebIFC.IFCSTAIRFLIGHT);
    expect(flights).toHaveLength(2);
    for (const f of flights) {
      expect(f.NumberOfRisers?.value ?? f.NumberOfRisers).toBe(8);
      expect(f.NumberOfTreads?.value ?? f.NumberOfTreads).toBe(7);
      expect(f.RiserHeight?.value ?? f.RiserHeight).toBeCloseTo(190.625, 9);
      expect(f.TreadLength?.value ?? f.TreadLength).toBeCloseTo(1800 / 7, 6);
      expect(enumValue(f.PredefinedType)).toBe("STRAIGHT");
    }
    expect(flights.map((f) => f.Tag.value).sort()).toEqual(["stair-flight-lower", "stair-flight-upper"]);
  });

  it("writes each landing as an IfcSlab LANDING", async () => {
    const slabs = await lines(await write(stairModel), WebIFC.IFCSLAB);
    const landing = slabs.find((s) => s.Tag.value === "stair-landing-half")!;
    expect(enumValue(landing.PredefinedType)).toBe("LANDING");
    expect(slabs.filter((s) => enumValue(s.PredefinedType) === "LANDING")).toHaveLength(1);
  });

  it("aggregates the flights and the landing under the stair, and contains only the stair", async () => {
    const ifc = await write(stairModel);
    const api = new WebIFC.IfcAPI();
    await api.Init();
    const id = api.OpenModel(ifc);
    try {
      const tag = (e: number) => api.GetLine(id, e).Tag?.value as string;
      const aggregates = ids(api, id, WebIFC.IFCRELAGGREGATES).map((e) => api.GetLine(id, e));
      const stairRel = aggregates.filter((r) => tag(r.RelatingObject.value) === "stair-main");
      expect(stairRel).toHaveLength(1);
      expect(stairRel[0]!.RelatedObjects.map((o: { value: number }) => tag(o.value)).sort()).toEqual([
        "stair-flight-lower",
        "stair-flight-upper",
        "stair-landing-half",
      ]);
      // Only the container is contained in the storey; the parts reach it through the aggregation.
      const contained = ids(api, id, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE)
        .map((e) => api.GetLine(id, e))
        .flatMap((c) => c.RelatedElements.map((e: { value: number }) => tag(e.value)));
      expect(contained).toContain("stair-main");
      for (const part of ["stair-flight-lower", "stair-flight-upper", "stair-landing-half"]) expect(contained).not.toContain(part);
    } finally {
      api.CloseModel(id);
    }
  });

  it("derives GlobalIds from the stair, flight and landing ids", async () => {
    const ifc = new TextDecoder().decode(await write(stairModel));
    for (const key of ["stair-main", "stair-flight-lower", "stair-flight-upper", "stair-landing-half", "stair-main#aggregates"]) {
      expect(ifc).toContain(`('${ifcGuid(key)}'`);
    }
  });

  it("styles both flights and the landing, and leaves the container unstyled", async () => {
    const ifc = new TextDecoder().decode(await write(stairModel));
    const style = /#(\d+)=IFCSURFACESTYLE\('stair'/.exec(ifc)![1];
    const styled = ifc.match(new RegExp(`IFCSTYLEDITEM\\(#\\d+,\\(#${style}\\)`, "g")) ?? [];
    expect(styled).toHaveLength(3); // two flights and one landing; the container has no body to style
  });

  it("matches the flight and landing volumes in the round-trip", async () => {
    const ifc = await write(stairModel);
    expect(await roundTripChecks(stairModel, ifc)).toEqual([]);
    const geom = await ifcGeometry(ifc);
    // Flight: stepped area less the tapered soffit, × width. run 1800, rise 1525, riser 190.625,
    // waist 150: (run×rise/2 − run×(rise−riser−waist)/2) × width.
    expect(geom.get("stair-flight-lower")!.volume).toBeCloseTo(((1800 * 1525) / 2 - (1800 * (1525 - 190.625 - 150)) / 2) * 800, 0);
    // Landing: 800 × 1600 outline × 150 thick.
    expect(geom.get("stair-landing-half")!.volume).toBeCloseTo(800 * 1600 * 150, 0);
    expect(geom.has("stair-main")).toBe(false); // the container has no body, and is not expected to
  });

  it("reports a stair part the IFC has no geometry for", async () => {
    const ifc = await write(stairModel);
    const ghost = structuredClone(stairModel);
    ghost.storeys[0]!.stairs![0]!.segments.push({
      kind: "flight",
      id: "stair-flight-ghost",
      start: { x: 0, y: 0 },
      end: { x: 1800, y: 0 },
      width: 800,
      risers: 8,
    } as never);
    const issues = await roundTripChecks(ghost, ifc);
    expect(issues.map((i) => i.id)).toContain("stair-flight-ghost");
    expect(issues.find((i) => i.id === "stair-flight-ghost")!.message).toMatch(/no geometry for this stair flight/);
  });

  it("reports a landing whose volume the IFC does not match", async () => {
    const ifc = await write(stairModel);
    const thicker = structuredClone(stairModel);
    const landing = thicker.storeys[0]!.stairs![0]!.segments[1]!;
    if (landing.kind === "landing") landing.thickness = 300 as never;
    const issues = await roundTripChecks(thicker, ifc);
    expect(issues.map((i) => i.id)).toEqual(["stair-landing-half"]);
    expect(issues[0]!.message).toMatch(/stair landing volume/);
  });
});

describe("a railing in IFC", () => {
  const railingModel = (() => {
    const base = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
    base.storeys[0]!.railings = [
      railing("railing-level", pt(mm(0), mm(0)), pt(m(3), mm(0)), { height: mm(900) }),
      railing("railing-sloped", pt(mm(0), mm(1000)), pt(mm(880), mm(1000)), { height: mm(900), startBase: mm(150), endBase: mm(600) }),
    ];
    return base;
  })();
  const write = (m: BuildingModel) => writeIfc(m, { fileName: "railing.ifc" });
  const enumValue = (v: unknown) => (typeof v === "string" ? v : ((v as { value?: string } | null)?.value ?? null));

  async function lines(ifc: Uint8Array, type: number) {
    const api = new WebIFC.IfcAPI();
    await api.Init();
    const id = api.OpenModel(ifc);
    try {
      return ids(api, id, type).map((e) => api.GetLine(id, e));
    } finally {
      api.CloseModel(id);
    }
  }

  it("writes level railings as GUARDRAIL and sloped ones as HANDRAIL", async () => {
    const railings = await lines(await write(railingModel), WebIFC.IFCRAILING);
    const byTag = new Map(railings.map((r) => [r.Tag.value as string, r]));
    expect(enumValue(byTag.get("railing-level")!.PredefinedType)).toBe("GUARDRAIL");
    expect(enumValue(byTag.get("railing-sloped")!.PredefinedType)).toBe("HANDRAIL");
    expect(byTag.get("railing-level")!.Name.value).toBe("railing-level");
  });

  it("styles every rail and post with the railing colour", async () => {
    const text = new TextDecoder().decode(await write(railingModel));
    const style = /#(\d+)=IFCSURFACESTYLE\('railing'/.exec(text)![1];
    const styled = text.match(new RegExp(`IFCSTYLEDITEM\\(#\\d+,\\(#${style}\\)`, "g")) ?? [];
    expect(styled).toHaveLength(29); // 21 for the 3 m level run (rail + 20 posts), 8 for the sloped run (rail + 7 posts)
  });

  it("orients the rail along the 3D run, not straight up", async () => {
    const ifc = await write(railingModel);
    const api = new WebIFC.IfcAPI();
    await api.Init();
    const id = api.OpenModel(ifc);
    try {
      const railingLine = ids(api, id, WebIFC.IFCRAILING)
        .map((e) => api.GetLine(id, e))
        .find((r) => r.Tag.value === "railing-sloped")!;
      const shape = api.GetLine(id, railingLine.Representation.value);
      const body = api.GetLine(id, shape.Representations[0].value);
      const railSolid = api.GetLine(id, body.Items[0].value);
      const depth = railSolid.Depth.value ?? railSolid.Depth;
      expect(depth).toBeCloseTo(Math.hypot(880, 450), 6);
      const position = api.GetLine(id, railSolid.Position.value);
      const axis = api.GetLine(id, position.Axis.value);
      const ratios = axis.DirectionRatios.map((v: { value?: number } | number) => (typeof v === "number" ? v : v.value));
      expect(ratios[2]).toBeGreaterThan(0.4); // the slope, not a vertical box
    } finally {
      api.CloseModel(id);
    }
  });

  it("matches the rail and post volumes in the round-trip", async () => {
    const ifc = await write(railingModel);
    expect(await roundTripChecks(railingModel, ifc)).toEqual([]);
    const geom = await ifcGeometry(ifc);
    for (const r of railingModel.storeys[0]!.railings!) expect(geom.get(r.id)!.volume).toBeCloseTo(railingGeometry(r).volume, 0);
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

  it("passes railings with no errors or warnings", async () => {
    const withRailings = structuredClone(elmstead);
    const path = join(dir, "railings.ifc");
    writeFileSync(path, await writeIfc(withRailings, { fileName: "railings.ifc" }));
    const v = validateIfc(path);
    expect(v.issues).toEqual([]);
    expect([v.errors, v.warnings]).toEqual([0, 0]);
  }, 60_000);

  it("passes a stair, its flights and its landing with no errors or warnings", async () => {
    const path = join(dir, "stair.ifc");
    writeFileSync(path, await writeIfc(BuildingModelSchema.parse(JSON.parse(JSON.stringify(twoStorey))), { fileName: "stair.ifc" }));
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

describe("elmstead external storey", () => {
  const elmsteadModel = BuildingModelSchema.parse(JSON.parse(JSON.stringify(elmstead)));

  it("writes the street storey, ground slab, front-step stair and railings, and round-trips", async () => {
    const ifc = await writeIfc(elmsteadModel, { fileName: "t.ifc" });
    const text = new TextDecoder().decode(ifc);
    expect(text).toMatch(/IFCSURFACESTYLE\('ground'/);
    expect(text.match(/IFCRAILING\(/g) ?? []).toHaveLength(4);
    expect(text).toMatch(/railing-front-north/);
    expect(text).toMatch(/railing-front-south/);
    expect(text).toMatch(/railing-front-facade-south/);
    expect(text).toMatch(/railing-front-corner/);
    expect(text.match(/\.HANDRAIL\./g) ?? []).toHaveLength(2);
    expect(text.match(/\.GUARDRAIL\./g) ?? []).toHaveLength(2);
    expect(text).toMatch(/stair-basement-external/);
    expect(text).toMatch(/stair-flight-basement-external/);
    expect(text).toMatch(/stair-landing-basement-external/);
    expect(await roundTripChecks(elmsteadModel, ifc)).toEqual([]);
  });
});
