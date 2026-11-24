import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage/index.js";
import { checkComponents } from "../src/checks/components.js";
import { doorDivision } from "../src/geometry/door.js";
import { roundTripChecks } from "../src/ifc/roundtrip.js";
import { writeIfc } from "../src/ifc/writer.js";
import { doorGeometry } from "../src/render/plan.js";
import { mm } from "../src/model/index.js";
import { BuildingModelSchema, type BuildingModel, type Door } from "../src/schema/schema.js";

/** The cottage with its external doors given a frame. */
function framed(width: number): BuildingModel {
  const m = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
  m.components!.doors[0]!.frame = { width: mm(width) };
  return m;
}

describe("door frames", () => {
  it("surround the leaf with jambs and a head, tiling the opening", () => {
    const { leaf, frame } = doorDivision({ width: mm(1000), height: mm(2100) }, { frame: { width: mm(50) } });
    expect(frame).toHaveLength(3);
    expect(leaf).toEqual({ x: 50, z: 0, w: 900, h: 2050 });
    expect([leaf, ...frame].reduce((a, r) => a + r.w * r.h, 0)).toBe(1000 * 2100);
  });

  it("leave the leaf filling an opening that has no frame", () => {
    expect(doorDivision({ width: mm(1000), height: mm(2100) })).toEqual({ leaf: { x: 0, z: 0, w: 1000, h: 2100 }, frame: [] });
  });

  it("must leave room for a leaf", () => {
    const m = framed(500);
    expect(checkComponents(m)[0]).toMatchObject({ level: "ERROR", id: "door-front", message: "1000 mm of frame leaves no leaf across: the door is only 900 mm wide" });
  });

  it("inset the plan leaf and swing by the frame", () => {
    const m = framed(50);
    const storey = m.storeys[0]!;
    const door = storey.openings.find((o): o is Door => o.kind === "door" && o.id === "door-front")!;
    const wall = storey.walls.find((w) => w.id === door.wallId)!;
    expect(doorGeometry(wall, door).leaf).toBe(900);
    expect(doorGeometry(wall, door, 50).leaf).toBe(800);
  });

  it("are written to IFC with their volume, and every door still meshes", async () => {
    const m = framed(50);
    const ifc = await writeIfc(m, { fileName: "t.ifc" });
    expect(await roundTripChecks(m, ifc)).toEqual([]);
    const text = new TextDecoder().decode(ifc);
    // Each framed external door is a leaf plus three frame pieces in one body representation.
    const bodies = [...text.matchAll(/IFCSHAPEREPRESENTATION\([^,]+,'Body','SweptSolid',\(([^)]*)\)\)/g)].map((x) => x[1]!.split(",").length);
    expect(bodies.filter((n) => n === 4)).toHaveLength(2);
  });
});