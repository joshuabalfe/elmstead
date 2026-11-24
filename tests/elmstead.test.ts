/**
 * Elmstead's floor structure: the upper storey sits on the walls below, and its floor gives every
 * room a floor while leaving the stairwell open.
 */
import { describe, expect, it } from "vitest";
import elmstead from "../models/elmstead/index.js";
import { stairwellOutline } from "../models/elmstead/first/index.js";
import { stairArrivalX } from "../models/elmstead/first/walls.js";
import { flightFootprint, stairLevels } from "../src/geometry/stair.js";
import { wallDirection, wallLength } from "../src/geometry/wall.js";
import { face, faceCrossing, mm } from "../src/model/index.js";
import type { Storey } from "../src/schema/schema.js";

type Pt = { x: number; y: number };

const centroid = (poly: Pt[]): Pt => {
  let x = 0;
  let y = 0;
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j]!.x * poly[i]!.y - poly[i]!.x * poly[j]!.y;
    area += cross;
    x += (poly[j]!.x + poly[i]!.x) * cross;
    y += (poly[j]!.y + poly[i]!.y) * cross;
  }
  return { x: x / (3 * area), y: y / (3 * area) };
};

const contains = (poly: Pt[], p: Pt): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

const wallTop = (s: Storey): number => s.elevation + Math.max(0, ...s.walls.map((w) => w.height));

describe("Elmstead's floor structure", () => {
  const storeys = [...elmstead.storeys].sort((a, b) => a.elevation - b.elevation);

  it("uses the owner's 2.7 m first-floor ceiling and a 150 mm lower bay", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const bay = new Set(["wall-bay-north-first", "wall-bay-front-first", "wall-bay-south-first"]);
    for (const wall of first.walls) expect(wall.height, wall.id).toBe(bay.has(wall.id) ? mm(2550) : mm(2700));
  });

  it("puts the kitchen window above the front door", () => {
    const ground = elmstead.storeys.find((s) => s.id === "storey-ground");
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!ground || !first) throw new Error("Elmstead needs ground and first floors");
    const door = ground.openings.find((o) => o.id === "door-front");
    const window = first.openings.find((o) => o.id === "window-kitchen-west-first");
    if (!door || !window) throw new Error("Elmstead needs the front door and kitchen window");
    const doorWall = ground.walls.find((w) => w.id === door.wallId);
    const windowWall = first.walls.find((w) => w.id === window.wallId);
    if (!doorWall || !windowWall) throw new Error("The front door and kitchen window need their walls");
    expect(windowWall.start).toEqual(doorWall.start);
    expect(window.offsetAlongWall + window.width / 2).toBe(door.offsetAlongWall + door.width / 2);
    expect(window.height).toBe(mm(2100));
    expect(window.sillHeight).toBe(mm(450));
    expect(window.componentId).toBe("window-type-cross");
    const design = elmstead.components?.windows.find((c) => c.id === window.componentId);
    expect(design?.frame?.width).toBe(mm(100));
    expect(design?.glazing).toMatchObject({ columns: [1, 1], rows: [1, 1] });
  });

  it("gives the kitchen the owner's step and door position", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const wall = (id: string) => {
      const w = first.walls.find((wall) => wall.id === id);
      if (!w) throw new Error(`Elmstead's first floor has no ${id}`);
      return w;
    };
    const step = wall("wall-kitchen-step-first");
    expect(wallLength(step)).toBe(mm(1275));
    expect(step.end.x - face(wall("wall-kitchen-east-lower-first"), "east")).toBe(mm(1100));
    expect(step.start.y - face(wall("wall-dining-north-first"), "north")).toBe(mm(1250));
    const door = first.openings.find((o) => o.id === "door-kitchen-first");
    if (!door || door.kind !== "door") throw new Error("Elmstead has no kitchen door");
    expect(wallLength(wall("wall-kitchen-east-first")) - (door.offsetAlongWall + door.width)).toBe(mm(50));
  });

  it("leaves a 50 mm jamb between the dining doorway and the partition", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const wall = first.walls.find((w) => w.id === "wall-dining-north-first");
    const doorway = first.openings.find((o) => o.id === "door-dining-first");
    if (!wall || !doorway) throw new Error("Elmstead needs the dining doorway and its wall");
    expect(wallLength(wall) - (doorway.offsetAlongWall + doorway.width)).toBe(mm(50));
  });

  it("makes every internal door and both doorways 768 mm wide", () => {
    const openings = elmstead.storeys.flatMap((s) => s.openings);
    const doors = openings.filter((o) => o.kind === "door" && !o.doorway && o.componentId === "door-type-internal");
    expect(doors).toHaveLength(6);
    for (const door of doors) expect(door.width, door.id).toBe(mm(768));
    for (const id of ["door-dining-first", "door-lobby"]) {
      expect(openings.find((o) => o.id === id)).toMatchObject({ kind: "door", doorway: true, width: 768 });
    }
  });

  it("gives the ensuite the owner's size", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const ensuite = first.rooms.find((r) => r.id === "room-ensuite-first");
    if (!ensuite) throw new Error("Elmstead has no ensuite");
    const xs = ensuite.outline.map((p) => p.x);
    const ys = ensuite.outline.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(mm(2790));
    expect(Math.max(...ys) - Math.min(...ys)).toBe(mm(1910));
  });

  it("measures the bedroom's main room, not the entrance strip", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const bedroom = first.rooms.find((r) => r.id === "room-bedroom-first");
    if (!bedroom?.dimensionOutline) throw new Error("The bedroom needs a dimension outline");
    const xs = bedroom.dimensionOutline.map((p) => p.x);
    const ys = bedroom.dimensionOutline.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(mm(3850));
    expect(Math.max(...ys) - Math.min(...ys)).toBe(mm(3565));
  });

  it("gives the ground-floor bedroom window the owner's size and twelve panes", () => {
    const ground = elmstead.storeys.find((s) => s.id === "storey-ground");
    if (!ground) throw new Error("Elmstead has no ground floor");
    const window = ground.openings.find((o) => o.id === "window-bedroom");
    if (!window || window.kind !== "window") throw new Error("Elmstead has no bedroom window");
    expect(window.width).toBe(mm(1200));
    expect(window.sillHeight).toBe(mm(500));
    expect(window.height).toBe(mm(2150));
    expect(window.sillHeight + window.height).toBe(mm(2650));
    expect(window.componentId).toBe("window-type-small-pane");
    const design = elmstead.components?.windows.find((c) => c.id === window.componentId);
    expect(design?.frame?.width).toBe(mm(100));
    expect(design?.glazing).toMatchObject({ columns: [1, 1, 1], rows: [1, 1, 1, 1], barWidth: mm(30) });
    expect(design!.glazing!.columns.length * design!.glazing!.rows.length).toBe(12);
  });

  it("gives the rear bedroom window the owner's size and corner", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const window = first.openings.find((o) => o.id === "window-bedroom-first");
    if (!window || window.kind !== "window") throw new Error("Elmstead has no rear bedroom window");
    expect(window.width).toBe(mm(1100));
    expect(window.height).toBe(mm(1950));
    expect(window.sillHeight).toBe(mm(500));
    expect(window.componentId).toBe("window-type-cross-bar");
    const design = elmstead.components?.windows.find((c) => c.id === window.componentId);
    expect(design?.frame?.width).toBe(mm(100));
    expect(design?.glazing).toMatchObject({ columns: [1], rows: [1, 1] });
    const east = first.walls.find((w) => w.id === "wall-east-first");
    const ensuiteSouth = first.walls.find((w) => w.id === "wall-ensuite-south-first");
    if (!east || !ensuiteSouth) throw new Error("The rear bedroom window needs its wall and the ensuite's");
    expect(east.start.y + window.offsetAlongWall + window.width).toBe(ensuiteSouth.start.y);
  });

  it("gives the bay windows the owner's size and bars", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const bay = (id: string) => {
      const o = first.openings.find((opening) => opening.id === id);
      if (!o || o.kind !== "window") throw new Error(`Elmstead has no ${id}`);
      return o;
    };
    const middle = bay("window-bay-front-first");
    const north = bay("window-bay-north-first");
    const south = bay("window-bay-south-first");
    const walls = new Map(first.walls.map((w) => [w.id, w]));
    for (const o of [middle, north, south]) {
      expect(o.height).toBe(mm(2100));
      expect(o.sillHeight).toBe(mm(450));
      const wall = walls.get(o.wallId);
      if (!wall) throw new Error(`${o.id} has no wall`);
      expect(o.offsetAlongWall, o.id).toBe(0);
      expect(o.width, o.id).toBe(Math.floor(wallLength(wall)));
      expect(o.sillHeight + o.height, o.id).toBe(wall.height);
    }
    const designs = new Map((elmstead.components?.windows ?? []).map((c) => [c.id, c]));
    expect(designs.get(middle.componentId!)?.glazing).toMatchObject({ columns: [1, 1], rows: [1, 1] });
    expect(designs.get(north.componentId!)?.glazing).toMatchObject({ columns: [1], rows: [1, 1] });
  });

  it("gives the front door a 1 m opening with a 50 mm frame", () => {
    const ground = elmstead.storeys.find((s) => s.id === "storey-ground");
    if (!ground) throw new Error("Elmstead has no ground floor");
    const door = ground.openings.find((o) => o.id === "door-front");
    const fanlight = ground.openings.find((o) => o.id === "window-front-fanlight");
    const component = elmstead.components?.doors.find((c) => c.id === door?.componentId);
    if (!door || !fanlight || !component) throw new Error("Elmstead needs the front door, its frame and fanlight");
    expect(door.width).toBe(mm(1000));
    expect(component.frame?.width).toBe(mm(50));
    expect(fanlight.offsetAlongWall).toBe(door.offsetAlongWall + 50);
    expect(fanlight.width).toBe(mm(900));
  });

  // Only built storeys carry the next floor on their walls; the street level is external.
  const built = storeys.filter((s) => s.walls.length > 0);
  for (let i = 1; i < built.length; i++) {
    const lower = built[i - 1]!;
    const upper = built[i]!;
    it(`${upper.id} sits on ${lower.id}'s walls`, () => {
      expect(upper.slabs.length).toBeGreaterThan(0);
      for (const slab of upper.slabs) {
        expect(upper.elevation + slab.elevationOffset).toBe(upper.elevation);
        expect(upper.elevation + slab.elevationOffset - slab.thickness).toBe(wallTop(lower));
      }
    });
  }

  it("keeps the stair well on its traced edges", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const wall = (id: string) => {
      const w = first.walls.find((wall) => wall.id === id);
      if (!w) throw new Error(`Elmstead's first floor has no ${id}`);
      return w;
    };
    const xs = stairwellOutline.map((p) => p.x);
    const ys = stairwellOutline.map((p) => p.y);
    // The landing overhang sets the well's west edge, 165 mm east of the longer ensuite's east face.
    expect(Math.min(...xs)).toBe(stairArrivalX);
    expect(Math.max(...xs)).toBe(face(wall("wall-extension-east-first"), "west"));
    expect(Math.min(...ys)).toBe(face(wall("wall-ensuite-north-first"), "north"));
    expect(Math.max(...ys)).toBe(face(wall("wall-north-first"), "south"));
  });

  it("angles the lobby screen to the spine's north corner", () => {
    const ground = elmstead.storeys.find((s) => s.id === "storey-ground");
    if (!ground) throw new Error("Elmstead has no ground floor");
    const wall = (id: string) => {
      const w = ground.walls.find((wall) => wall.id === id);
      if (!w) throw new Error(`Elmstead's ground floor has no ${id}`);
      return w;
    };
    const screen = wall("wall-lobby-screen");
    const hall = wall("wall-hall-living");
    const spine = wall("wall-stair-spine");
    expect(screen.start.y).toBeGreaterThan(face(hall, "south"));
    expect(screen.start.y).toBeLessThan(face(hall, "north"));
    // The hallway-side face, not the centreline, meets the spine's north-west corner.
    const at = ground.rooms.find((r) => r.id === "room-hallway")!.outline[2]!;
    expect(Math.abs(at.x - spine.start.x)).toBeLessThanOrEqual(1);
    expect(at.y).toBe(face(spine, "north"));
  });

  it("keeps the lobby doorway clear of the stair spine", () => {
    const ground = elmstead.storeys.find((s) => s.id === "storey-ground");
    if (!ground) throw new Error("Elmstead has no ground floor");
    const wall = (id: string) => {
      const w = ground.walls.find((wall) => wall.id === id);
      if (!w) throw new Error(`Elmstead's ground floor has no ${id}`);
      return w;
    };
    const screen = wall("wall-lobby-screen");
    const spine = wall("wall-stair-spine");
    const living = wall("wall-living-bedroom");
    const door = ground.openings.find((o) => o.id === "door-lobby");
    if (!door) throw new Error("Elmstead has no lobby doorway");
    const along = (p: Pt): number => {
      const d = wallDirection(screen);
      return (p.x - screen.start.x) * d.x + (p.y - screen.start.y) * d.y;
    };
    const lobbyStart = along(faceCrossing(screen, "right", "x", face(living, "east")));
    const spineEntry = along(faceCrossing(screen, "right", "x", spine.start.x));
    expect(door.offsetAlongWall - lobbyStart).toBeGreaterThan(0);
    expect(spineEntry - (door.offsetAlongWall + door.width)).toBeGreaterThan(0);
  });

  it("joins the dining/bedroom partition to the bedroom's north wall", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const partition = first.walls.find((w) => w.id === "wall-dining-bedroom-first");
    const bedroomNorth = first.walls.find((w) => w.id === "wall-bedroom-north-first");
    if (!partition || !bedroomNorth) throw new Error("Elmstead needs the dining/bedroom partition and the bedroom's north wall");
    expect(partition.end.y).toBe(face(bedroomNorth, "north"));
  });

  it("keeps the landing floor off the dining/bedroom partition", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const landing = first.rooms.find((r) => r.id === "room-landing-first");
    const partition = first.walls.find((w) => w.id === "wall-dining-bedroom-first");
    if (!landing || !partition) throw new Error("Elmstead needs the landing and the dining/bedroom partition");
    expect(contains(landing.outline, { x: face(partition, "west") + 1, y: partition.end.y - 1 })).toBe(false);
  });

  it("gives every first-floor room a floor and leaves the stairwell open", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    for (const room of first.rooms) {
      const at = centroid(room.outline);
      expect(first.slabs.some((s) => contains(s.outline, at)), `${room.id}'s centroid is not on a slab`).toBe(true);
      expect(contains(stairwellOutline, at), `${room.id}'s centroid is inside the stairwell`).toBe(false);
    }
  });
});

describe("Elmstead's stair", () => {
  const ground = elmstead.storeys.find((s) => s.id === "storey-ground")!;
  const first = elmstead.storeys.find((s) => s.id === "storey-first-floor")!;
  const stair = ground.stairs?.[0];

  // The well is a rectangle; outset it 1 mm so corners that lie exactly on its edge count as inside.
  // The stair bottom sits west of the well's traced edge, under the landing overhang, so include it.
  const xs = stairwellOutline.map((p) => p.x);
  const ys = stairwellOutline.map((p) => p.y);
  const bottom = stair?.segments[0];
  const west = Math.min(...xs, bottom?.kind === "flight" ? bottom.start.x : Infinity);
  const well = [
    { x: west - 1, y: Math.min(...ys) - 1 },
    { x: Math.max(...xs) + 1, y: Math.min(...ys) - 1 },
    { x: Math.max(...xs) + 1, y: Math.max(...ys) + 1 },
    { x: west - 1, y: Math.max(...ys) + 1 },
  ];

  it("climbs to the first floor inside the reserved stairwell", () => {
    expect(stair).toBeDefined();
    expect(stair!.toStoreyId).toBe(first.id);
    for (const seg of stair!.segments) {
      const poly = seg.kind === "flight" ? flightFootprint(seg) : seg.outline;
      for (const p of poly) {
        expect(contains(well, p), `${seg.id} corner (${p.x}, ${p.y}) is outside the stairwell`).toBe(true);
      }
    }
  });

  it("derives the owner's 17 risers and 320 mm goings, landing on the first floor", () => {
    const rise = first.elevation - ground.elevation;
    const levels = stairLevels(stair!, rise);
    const top = levels.segments[levels.segments.length - 1]!;
    expect(top.kind).toBe("flight");
    expect(top.kind === "flight" ? top.top : top.level).toBe(rise);
    expect(levels.totalRisers).toBe(17); // owner
    expect(levels.riser).toBeGreaterThan(170); // ~180 mm, owner
    expect(levels.riser).toBeLessThan(190);
    for (const seg of levels.segments) {
      // owner: 320 mm steps on the lower flight, 280 mm on the upper
      if (seg.kind === "flight") expect(seg.going).toBe(seg.segment.id === "stair-flight-lower" ? 320 : 280);
    }
  });
});