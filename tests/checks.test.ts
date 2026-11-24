import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import { checkComponents } from "../src/checks/components.js";
import { checkIds, checkModel, checkOpenings, checkOutlines, checkWalls } from "../src/checks/model.js";
import { wallLength } from "../src/geometry/wall.js";
import { deg, m as metres, mm, pt, wall as makeWall, window as makeWindow, type Reveal } from "../src/model/index.js";
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
    expect(checkIds(m)).toEqual([{ level: "ERROR", id: "room-living", message: "id is used by two rooms" }]);
  });

  it("reports an element and a component that share an id", () => {
    const m = model();
    m.components!.windows[0]!.id = "wall-south";
    expect(checkIds(m)).toEqual([{ level: "ERROR", id: "wall-south", message: "id is used by a wall and a window component" }]);
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

  describe("with splayed reveals", () => {
    // A 6 m wall, 400 mm thick, so a 45° reveal splays each jamb 200 mm at its face.
    const w = makeWall("wall-a", pt(mm(0), mm(0)), pt(metres(6), mm(0)), { thickness: mm(400), height: metres(2.4) });
    const size = { width: mm(1200), height: metres(1.2), sillHeight: mm(900) };
    const reveal = (face: Reveal["face"]): Reveal => ({ face, angle: deg(45) });
    const withOpenings = (...openings: ReturnType<typeof makeWindow>[]): BuildingModel => {
      const m = model();
      m.storeys[0]!.walls = [w];
      m.storeys[0]!.openings = openings;
      return m;
    };

    it("reports a reveal past the wall start or end at its splayed face", () => {
      expect(checkOpenings(withOpenings(makeWindow("window-a", w, mm(100), size, reveal("left"))))).toEqual([
        { level: "ERROR", id: "window-a", message: "opening is 100 mm past the wall start" },
      ]);
      expect(checkOpenings(withOpenings(makeWindow("window-a", w, mm(4700), size, reveal("right"))))).toEqual([
        { level: "ERROR", id: "window-a", message: "opening is 100 mm past the wall end" },
      ]);
      expect(checkOpenings(withOpenings(makeWindow("window-a", w, mm(200), size, reveal("left"))))).toEqual([]);
    });

    it("reports reveals that meet at the face they both splay to", () => {
      const a = makeWindow("window-a", w, mm(1000), size, reveal("left"));
      const b = makeWindow("window-b", w, mm(2500), size, reveal("left")); // 300 mm clear of window-a
      expect(checkOpenings(withOpenings(a, b))).toEqual([
        { level: "ERROR", id: "window-a", message: "opening overlaps window-b" },
        { level: "ERROR", id: "window-b", message: "opening overlaps window-a" },
      ]);
    });

    it("allows reveals on opposite faces that stop short of each other", () => {
      const a = makeWindow("window-a", w, mm(1000), size, reveal("left"));
      const b = makeWindow("window-b", w, mm(2500), size, reveal("right"));
      expect(checkOpenings(withOpenings(a, b))).toEqual([]);
    });

    it("reports a reveal that reaches into a square opening", () => {
      const a = makeWindow("window-a", w, mm(1000), size, reveal("left"));
      const b = makeWindow("window-b", w, mm(2300), size); // 100 mm clear, inside window-a's 200 mm splay
      expect(checkOpenings(withOpenings(a, b)).map((i) => i.id)).toEqual(["window-a", "window-b"]);
    });
  });
});

describe("checkOutlines", () => {
  it("reports a self-intersecting room", () => {
    const m = model();
    m.storeys[0]!.rooms[0]!.outline = [pt(mm(0), mm(0)), pt(mm(1000), mm(1000)), pt(mm(1000), mm(0)), pt(mm(0), mm(1000))];
    expect(checkOutlines(m)).toContainEqual({ level: "ERROR", id: "room-living", message: "outline crosses itself" });
  });

  it("reports a self-intersecting dimension outline", () => {
    const m = model();
    m.storeys[0]!.rooms[0]!.dimensionOutline = [pt(mm(0), mm(0)), pt(mm(1000), mm(1000)), pt(mm(1000), mm(0)), pt(mm(0), mm(1000))];
    expect(checkOutlines(m)).toContainEqual({ level: "ERROR", id: "room-living", message: "dimension outline: outline crosses itself" });
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
    expect(messages).toContain("id is used by two rooms");
    expect(messages).toContain("zero-length wall cannot be written to IFC");
    expect(messages).toContain("wallId wall-missing is not a wall on this storey");
  });
});