import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage/index.js";
import { checkComponents } from "../src/checks/components.js";
import { checkOpenings } from "../src/checks/model.js";
import { doorDivision } from "../src/geometry/door.js";
import { ifcGuid } from "../src/ifc/guid.js";
import { roundTripChecks } from "../src/ifc/roundtrip.js";
import { writeIfc } from "../src/ifc/writer.js";
import { doorway, mm } from "../src/model/index.js";
import { doorGeometry, renderFloor, renderPlan, renderWallTops } from "../src/render/plan.js";
import { BuildingModelSchema, type BuildingModel, type Door } from "../src/schema/schema.js";

/** The cottage with its external doors given a frame. */
function framed(width: number): BuildingModel {
  const m = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
  m.components!.doors[0]!.frame = { width: mm(width) };
  return m;
}

/** The cottage with a plain doorway in its west wall: no leaf, frame or swing. */
function withDoorway(): BuildingModel {
  const m = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
  const storey = m.storeys[0]!;
  const wall = storey.walls.find((w) => w.id === "wall-west")!;
  storey.openings.push(doorway("doorway-west", wall, mm(500), { width: mm(900), height: mm(2100) }));
  return BuildingModelSchema.parse(JSON.parse(JSON.stringify(m)));
}

describe("doorways", () => {
  it("is a door opening with no component or swing", () => {
    const m = withDoorway();
    const o = m.storeys[0]!.openings.find((o) => o.id === "doorway-west")!;
    expect(o).toMatchObject({ kind: "door", doorway: true, sillHeight: 0, width: 900, height: 2100 });
    expect(o).not.toHaveProperty("componentId");
    expect(o).not.toHaveProperty("swing");
    expect(checkOpenings(m)).toEqual([]);
  });

  it("rejects a component or swing on a doorway", () => {
    const swingModel = withDoorway();
    const swing = swingModel.storeys[0]!.openings.find((o): o is Door => o.kind === "door" && o.id === "doorway-west")!;
    swing.swing = { hinge: "start", side: "left" };
    expect(checkOpenings(swingModel)).toContainEqual({ level: "ERROR", id: "doorway-west", message: "a doorway has no component or swing" });

    const componentModel = withDoorway();
    const component = componentModel.storeys[0]!.openings.find((o) => o.id === "doorway-west")!;
    component.componentId = "door-type-internal";
    expect(checkOpenings(componentModel)).toContainEqual({ level: "ERROR", id: "doorway-west", message: "a doorway has no component or swing" });
  });

  it("draws the opening but no leaf or swing, in the plan and the floor overlay", () => {
    const m = withDoorway();
    const storey = m.storeys[0]!;
    const plan = renderPlan(m, storey, { ids: false });
    // The plan draws the opening's gap but no leaf or swing.
    expect(plan).not.toContain('class="door" data-id="doorway-west"');
    expect([...plan.matchAll(/class="wall" data-id="wall-west"/g)]).toHaveLength(2);
    expect(renderWallTops(storey, m.components).svg).toContain('class="door-gap" data-id="doorway-west"');
    expect(renderFloor(storey, m.components).svg).not.toContain("doorway-west");
  });

  it("writes the opening to IFC with no door or filling, and the wall still rounds-trips", async () => {
    const m = withDoorway();
    const plain = await writeIfc(BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage))), { fileName: "t.ifc" });
    const ifc = await writeIfc(m, { fileName: "t.ifc" });
    expect(await roundTripChecks(m, ifc)).toEqual([]);
    const text = new TextDecoder().decode(ifc);
    const base = new TextDecoder().decode(plain);
    const count = (s: string, re: RegExp) => [...s.matchAll(re)].length;
    expect(count(text, /IFCOPENINGELEMENT\(/g)).toBe(count(base, /IFCOPENINGELEMENT\(/g) + 1);
    expect(count(text, /IFCDOOR\(/g)).toBe(count(base, /IFCDOOR\(/g));
    expect(count(text, /IFCRELFILLSELEMENT\(/g)).toBe(count(base, /IFCRELFILLSELEMENT\(/g));
    expect(text).toContain(`('${ifcGuid("doorway-west")}'`);
    const openingLine = text.split("\n").find((l) => l.includes("IFCOPENINGELEMENT(") && l.includes("'doorway-west'"));
    // The Name also contains the id; only the tag immediately before .OPENING. proves the Tag is set.
    expect(openingLine ?? "").toMatch(/,'doorway-west',\.OPENING\.\);\r?$/);
  });
});

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