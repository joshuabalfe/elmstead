import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage.js";
import { ifcGuid } from "../src/ifc/guid.js";
import { ifcGeometry, roundTripChecks } from "../src/ifc/roundtrip.js";
import { validateIfc } from "../src/ifc/validate.js";
import { writeIfc } from "../src/ifc/writer.js";
import { BuildingModelSchema, type BuildingModel } from "../src/schema/schema.js";

const model = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
const text = async (m: BuildingModel) => new TextDecoder().decode(await writeIfc(m, { fileName: "t.ifc" }));
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
