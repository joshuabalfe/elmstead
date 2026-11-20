import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage.js";
import elmstead from "../models/elmstead/index.js";
import { checkComponents } from "../src/checks/components.js";
import { checkIds, checkModel, checkOpenings, checkOutlines, checkWalls } from "../src/checks/model.js";
import { wallLength } from "../src/geometry/wall.js";
import { mm, pt } from "../src/model/index.js";
import { BuildingModelSchema, type BuildingModel } from "../src/schema/schema.js";

const model = (source: unknown = cottage): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));
const opening = (m: BuildingModel, id: string) => m.storeys[0]!.openings.find((o) => o.id === id)!;
const wall = (m: BuildingModel, id: string) => m.storeys[0]!.walls.find((w) => w.id === id)!;

describe("checkComponents", () => {
  it("accepts the cottage, whose openings all name a component of their kind", () => {
    expect(checkComponents(model())).toEqual([]);
  });

  it("reports a componentId that is not in components, against the opening", () => {
    const m = model();
    opening(m, "door-living").componentId = "door-type-missing";
    expect(checkComponents(m)).toEqual([{ level: "ERROR", id: "door-living", message: "componentId door-type-missing is not in components" }]);
  });

  it("reports a door that names a window component", () => {
    const m = model();
    opening(m, "door-living").componentId = "window-type-sash";
    expect(checkComponents(m)).toEqual([{ level: "ERROR", id: "door-living", message: "componentId window-type-sash is a window component" }]);
  });

  it("accepts openings without a component, and models without components", () => {
    const m = model();
    delete m.components;
    for (const o of m.storeys[0]!.openings) delete o.componentId;
    expect(checkComponents(m)).toEqual([]);
  });
});

describe("checkIds", () => {
  it("reports a duplicate room id once, against that id", () => {
    const m = model();
    m.storeys[0]!.rooms[1]!.id = m.storeys[0]!.rooms[0]!.id;
    expect(checkIds(m)).toEqual([{ level: "ERROR", id: "room-living", message: "id is already used by room" }]);
  });

  it("reports an element and a component that share an id", () => {
    const m = model();
    m.components!.windows[0]!.id = "wall-south";
    expect(checkIds(m)).toEqual([{ level: "ERROR", id: "wall-south", message: "id is already used by wall" }]);
  });

  it("keeps the component-specific message for two components with one id", () => {
    const m = model();
    m.components!.windows.push({ ...m.components!.doors[0]! });
    expect(checkIds(m)).toEqual([{ level: "ERROR", id: "door-type-external", message: "component id is used twice" }]);
  });
});

describe("checkWalls", () => {
  it("reports a wall whose start and end are the same", () => {
    const m = model();
    const w = wall(m, "wall-south");
    w.end = { ...w.start };
    expect(checkWalls(m)).toEqual([{ level: "ERROR", id: "wall-south", message: "zero-length wall cannot be written to IFC" }]);
  });
});

describe("checkOpenings", () => {
  it("reports an opening whose wall is not on its storey", () => {
    const m = model();
    opening(m, "door-living").wallId = "wall-missing";
    expect(checkOpenings(m)).toEqual([{ level: "ERROR", id: "door-living", message: "wallId wall-missing is not a wall on this storey" }]);
  });

  it("reports an opening past the wall end and one above the wall top", () => {
    const m = model();
    const o = opening(m, "door-living");
    const w = wall(m, o.wallId);
    o.offsetAlongWall = mm(wallLength(w));
    expect(checkOpenings(m)).toEqual([{ level: "ERROR", id: "door-living", message: `opening is ${o.width} mm past the wall end` }]);
    o.offsetAlongWall = mm(0);
    o.sillHeight = w.height;
    expect(checkOpenings(m)).toEqual([{ level: "ERROR", id: "door-living", message: `opening is ${o.height} mm above the wall top` }]);
  });

  it("reports two openings that cut the same wall volume against both", () => {
    const m = model();
    const door = opening(m, "door-front");
    const window = opening(m, "window-living");
    window.offsetAlongWall = door.offsetAlongWall;
    expect(checkOpenings(m)).toEqual([
      { level: "ERROR", id: "door-front", message: "opening overlaps window-living" },
      { level: "ERROR", id: "window-living", message: "opening overlaps door-front" },
    ]);
  });

  it("allows openings that touch at an edge", () => {
    const m = model();
    const door = opening(m, "door-front");
    const window = opening(m, "window-living");
    window.offsetAlongWall = mm(door.offsetAlongWall - window.width);
    expect(checkOpenings(m)).toEqual([]);
  });
});

describe("checkOutlines", () => {
  it("reports a self-intersecting room", () => {
    const m = model();
    m.storeys[0]!.rooms[0]!.outline = [pt(mm(0), mm(0)), pt(mm(1000), mm(1000)), pt(mm(1000), mm(0)), pt(mm(0), mm(1000))];
    expect(checkOutlines(m)).toContainEqual({ level: "ERROR", id: "room-living", message: "outline crosses itself" });
  });

  it("reports a slab that repeats its first point", () => {
    const m = model();
    const slab = m.storeys[0]!.slabs[0]!;
    slab.outline = [slab.outline[0]!, slab.outline[1]!, slab.outline[2]!, slab.outline[0]!];
    expect(checkOutlines(m)).toEqual([{ level: "ERROR", id: "slab-ground", message: "outline repeats its first point at the end" }]);
  });
});

describe("checkModel", () => {
  it("accepts every example model", () => {
    expect(checkModel(model())).toEqual([]);
    expect(checkModel(model(elmstead))).toEqual([]);
  });

  it("aggregates the component, id, wall, opening and outline rules", () => {
    const m = model();
    m.storeys[0]!.rooms[1]!.id = m.storeys[0]!.rooms[0]!.id;
    wall(m, "wall-south").end = { ...wall(m, "wall-south").start };
    opening(m, "door-living").wallId = "wall-missing";
    const messages = checkModel(m).map((i) => i.message);
    expect(messages).toContain("id is already used by room");
    expect(messages).toContain("zero-length wall cannot be written to IFC");
    expect(messages).toContain("wallId wall-missing is not a wall on this storey");
  });
});