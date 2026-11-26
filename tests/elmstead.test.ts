/**
 * Elmstead's floor structure: the upper storey sits on the walls below, and its floor gives every
 * room a floor while leaving the stairwell open.
 */
import { describe, expect, it } from "vitest";
import elmstead from "../models/elmstead/index.js";
import { stairwellOutline } from "../models/elmstead/first/index.js";
import { stairArrivalX, stairNorthY, stairSouthY } from "../models/elmstead/first/walls.js";
import { coreW, extEastX } from "../models/elmstead/shared.js";
import { checkModel } from "../src/checks/model.js";
import { railingGeometry } from "../src/geometry/railing.js";
import { flightFootprint, stairLevels } from "../src/geometry/stair.js";
import { wallDirection, wallHeight, wallLength } from "../src/geometry/wall.js";
import { face, faceCrossing, mm } from "../src/model/index.js";
import { renderFloor, renderPlan } from "../src/render/plan.js";
import { C } from "../src/render/style.js";
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

const wallTop = (s: Storey): number => s.elevation + Math.max(0, ...s.walls.map((w) => wallHeight(w)));

describe("Elmstead's floor structure", () => {
  const storeys = [...elmstead.storeys].sort((a, b) => a.elevation - b.elevation);

  it("uses the owner's 2.7 m first-floor ceiling and a 150 mm lower bay", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const bay = new Set(["wall-bay-north-first", "wall-bay-front-first", "wall-bay-south-first"]);
    const extension = new Set(["wall-north-extension-first", "wall-extension-east-first", "wall-extension-south-first"]);
    for (const wall of first.walls) {
      if (extension.has(wall.id)) continue; // the extension roof slopes; see the taper test below
      expect(wall.height, wall.id).toBe(bay.has(wall.id) ? mm(2550) : mm(2700));
    }
  });

  it("tapers the extension roof from the first-floor ceiling where the extension starts", () => {
    // The extension is split level, so its top walls stand on the attic half landing.
    const half = elmstead.storeys.find((s) => s.id === "storey-attic-half-landing");
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!half || !first) throw new Error("Elmstead needs the first floor and the attic half landing");
    const wall = (id: string) => {
      const w = half.walls.find((wall) => wall.id === id);
      if (!w) throw new Error(`Elmstead's attic half landing has no ${id}`);
      return w;
    };
    const northExt = wall("wall-north-extension-attic-half-landing");
    const extSouth = wall("wall-extension-south-attic-half-landing");
    const extEast = wall("wall-extension-east-attic-half-landing");
    const ceiling = first.elevation + 2700; // the first floor's 2.7 m ceiling, owner
    const level = (up: number) => half.elevation + up;
    // Full ceiling at the extension start (coreW), falling towards the extension east.
    expect(level(northExt.profile!.at(-1)!.up)).toBe(ceiling);
    expect(level(extSouth.profile![0]!.up)).toBe(ceiling);
    expect(northExt.profile![0]!.up).toBe(extEast.height);
    expect(extSouth.profile!.at(-1)!.up).toBe(extEast.height); // south slope meets the east wall flush too
    // The taper continues the attic gable's pitch, derived from the attic ridge rather than hardcoded.
    const attic = elmstead.storeys.find((s) => s.id === "storey-attic")!;
    const ridge = attic.walls.find((w) => w.id === "wall-south-attic")!.profile![1]!;
    const pitch = ridge.up / ridge.along;
    expect(level(extEast.height!)).toBe(Math.round(ceiling - pitch * (extEastX - coreW)));
  });

  it("stands the extension's walls on the half landings, one above the other", () => {
    const storey = (id: string) => elmstead.storeys.find((s) => s.id === id)!;
    const ground = storey("storey-ground");
    const main = storey("storey-main-half-landing");
    const attic = storey("storey-attic-half-landing");
    const top = (s: Storey, id: string) => s.elevation + wallHeight(s.walls.find((w) => w.id === id)!);
    for (const side of ["east", "south"]) {
      expect(top(ground, `wall-extension-${side}`), side).toBe(main.elevation);
      expect(top(main, `wall-extension-${side}-main-half-landing`), side).toBe(attic.elevation);
    }
    expect(top(ground, "wall-north-extension")).toBe(main.elevation);
    expect(top(main, "wall-north-extension-main-half-landing")).toBe(attic.elevation);
    expect(storey("storey-first-floor").walls.some((w) => w.id.includes("extension"))).toBe(false);
  });

  it("pins the attic's gable geometry: floor-to-ridge gables, front parapet, core slab with the stair well open", () => {
    const attic = elmstead.storeys.find((s) => s.id === "storey-attic");
    if (!attic) throw new Error("Elmstead has no attic");
    const wall = (id: string) => {
      const w = attic.walls.find((wall) => wall.id === id);
      if (!w) throw new Error(`Elmstead's attic has no ${id}`);
      return w;
    };
    for (const id of ["wall-north-attic", "wall-south-attic"]) {
      const gable = wall(id);
      const L = wallLength(gable);
      expect(gable.profile![0]!.up, id).toBe(mm(0)); // gable runs to the floor at both eaves
      expect(gable.profile!.at(-1)!.up, id).toBe(mm(0));
      expect(Math.max(...gable.profile!.map((p) => p.up)), id).toBe(mm(3200)); // owner's ridge estimate
      expect(gable.profile!.at(-1)!.along, id).toBe(mm(Math.round(L)));
    }
    expect(wall("wall-west-attic").height).toBe(mm(700)); // owner's front parapet
    expect(wallLength(wall("wall-west-attic"))).toBe(mm(8425)); // full width
    expect(attic.walls.some((w) => w.id === "wall-east-attic")).toBe(false); // rear open at floor
    expect(attic.slabs).toHaveLength(1);
    const slab = attic.slabs[0]!.outline;
    const xs = slab.map((p) => p.x);
    expect(Math.min(...xs)).toBe(mm(0));
    expect(Math.max(...xs)).toBe(coreW); // core only, not the extension
    // The stair well is cut out of the north-east corner, open to the rear (east) edge.
    const wellCentre = { x: (stairArrivalX + coreW) / 2, y: (stairSouthY + stairNorthY) / 2 };
    expect(contains(slab, wellCentre)).toBe(false);
    expect(contains(slab, { x: mm(1000), y: mm(1000) })).toBe(true); // solid core still floored
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
    expect(doors).toHaveLength(10);
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

  // Only built floors carry the next floor on their walls; the street level is external, and the
  // half landings are platforms in the stair wells rather than floors.
  const built = storeys.filter((s) => s.walls.length > 0 && !s.id.endsWith("-half-landing"));
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
    const main = elmstead.storeys.find((s) => s.id === "storey-main-half-landing")!;
    expect(Math.max(...xs)).toBe(face(main.walls.find((w) => w.id === "wall-extension-east-main-half-landing")!, "west"));
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
  const storey = (id: string) => elmstead.storeys.find((s) => s.id === id)!;
  const ground = storey("storey-ground");
  const half = storey("storey-main-half-landing");
  const first = storey("storey-first-floor");
  const lowerStair = ground.stairs?.[0];
  const upperStair = half.stairs?.[0];
  const parts = [half.slabs[0]!.outline, ...[lowerStair, upperStair].flatMap((s) => s?.segments ?? []).map((seg) => (seg.kind === "flight" ? flightFootprint(seg) : seg.outline))];

  // The well is a rectangle; outset it 1 mm so corners that lie exactly on its edge count as inside.
  // The stair bottom sits west of the well's traced edge, under the landing overhang, so include it.
  const xs = stairwellOutline.map((p) => p.x);
  const ys = stairwellOutline.map((p) => p.y);
  const bottom = lowerStair?.segments[0];
  const west = Math.min(...xs, bottom?.kind === "flight" ? bottom.start.x : Infinity);
  const well = [
    { x: west - 1, y: Math.min(...ys) - 1 },
    { x: Math.max(...xs) + 1, y: Math.min(...ys) - 1 },
    { x: Math.max(...xs) + 1, y: Math.max(...ys) + 1 },
    { x: west - 1, y: Math.max(...ys) + 1 },
  ];

  it("climbs to the first floor by its half landing, inside the reserved stairwell", () => {
    expect(lowerStair?.toStoreyId).toBe(half.id);
    expect(upperStair?.toStoreyId).toBe(first.id);
    for (const poly of parts) {
      for (const p of poly) expect(contains(well, p), `corner (${p.x}, ${p.y}) is outside the stairwell`).toBe(true);
    }
  });

  it("derives the owner's 9 + 8 risers and 320 mm goings, landing on each storey", () => {
    const flights = [
      { stair: lowerStair!, from: ground, to: half, risers: 9, going: 320 },
      { stair: upperStair!, from: half, to: first, risers: 8, going: 280 }, // owner: 280 mm steps above
    ];
    for (const f of flights) {
      const rise = f.to.elevation - f.from.elevation;
      const levels = stairLevels(f.stair, rise);
      const top = levels.segments.at(-1)!;
      expect(top.kind === "flight" ? top.top : top.level).toBe(rise);
      expect(levels.totalRisers).toBe(f.risers); // owner: 17 in all
      expect(levels.riser).toBeGreaterThan(170); // ~180 mm, owner
      expect(levels.riser).toBeLessThan(190);
      for (const seg of levels.segments) if (seg.kind === "flight") expect(seg.going).toBe(f.going);
    }
  });
});

describe("Elmstead's main half landing window", () => {
  it("has the owner's 1.2 × 2.1 m window, 450 mm off the landing, in the extension's east wall, framed like the bedroom window", () => {
    const half = elmstead.storeys.find((s) => s.id === "storey-main-half-landing")!;
    const win = half.openings.find((o) => o.id === "window-main-half-landing");
    expect(win?.wallId).toBe("wall-extension-east-main-half-landing");
    expect([win!.width, win!.height, win!.sillHeight]).toEqual([mm(1200), mm(2100), mm(450)]); // owner
    // owner: the same frame as the first-floor bedroom window
    const bedroom = elmstead.storeys.find((s) => s.id === "storey-first-floor")!.openings.find((o) => o.id === "window-bedroom-first");
    expect(win!.componentId).toBe(bedroom!.componentId);
  });
});

describe("Elmstead's attic stair", () => {
  const storey = (id: string) => elmstead.storeys.find((s) => s.id === id)!;
  const first = storey("storey-first-floor");
  const half = storey("storey-attic-half-landing");
  const attic = storey("storey-attic");

  it("climbs the owner's 8 + 8 risers by a half landing inside the core", () => {
    expect(first.stairs?.[0]?.toStoreyId).toBe(half.id);
    expect(half.stairs?.[0]?.toStoreyId).toBe(attic.id);
    const lower = stairLevels(first.stairs![0]!, half.elevation - first.elevation);
    const upper = stairLevels(half.stairs![0]!, attic.elevation - half.elevation);
    expect([lower.totalRisers, upper.totalRisers]).toEqual([8, 8]); // owner
    expect(lower.riser).toBe(upper.riser);
    // The smaller half landing stays inside the core, under the attic's well.
    expect(Math.max(...half.slabs[0]!.outline.map((p) => p.x))).toBe(coreW);
  });

  it("has a wall at the back of the half landing, up to the attic floor", () => {
    const back = half.walls.find((w) => w.id === "wall-attic-half-landing-back");
    expect(back).toBeDefined();
    expect([back!.start.x, back!.end.x]).toEqual([coreW, coreW]);
    expect([back!.start.y, back!.end.y]).toEqual([stairSouthY, stairNorthY]);
    expect(half.elevation + back!.height!).toBe(attic.elevation);
  });

  it("floors the reduced-height space behind the back wall, out to the extension walls", () => {
    const floor = half.slabs.find((s) => s.id === "slab-attic-half-landing-behind");
    expect(floor).toBeDefined();
    const xs = floor!.outline.map((p) => p.x);
    const ys = floor!.outline.map((p) => p.y);
    const extEast = half.walls.find((w) => w.id === "wall-extension-east-attic-half-landing")!;
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([coreW, face(extEast, "west")]);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([stairSouthY, stairNorthY]);
    expect(floor!.elevationOffset).toBe(0);
  });
});

describe("Elmstead's front steps", () => {
  it("has the owner's four steps from the street to the front door", () => {
    const street = elmstead.storeys.find((s) => s.id === "storey-street");
    const ground = elmstead.storeys.find((s) => s.id === "storey-ground");
    if (!street || !ground) throw new Error("Elmstead needs the street and ground storeys");
    const flight = street.stairs?.[0]?.segments[0];
    if (!flight || flight.kind !== "flight") throw new Error("The front steps should be one flight");
    expect(flight.risers).toBe(4);
    expect(ground.elevation - street.elevation).toBe(mm(600));
  });
});

describe("Elmstead's railings", () => {
  const street = elmstead.storeys.find((s) => s.id === "storey-street")!;
  const ground = elmstead.storeys.find((s) => s.id === "storey-ground")!;
  const rail = (id: string) => street.railings?.find((r) => r.id === id);

  it("has two nosing-line step rails, a level front rail and a corner return", () => {
    expect(street.railings?.map((r) => r.id).sort()).toEqual(["railing-front-corner", "railing-front-facade-south", "railing-front-north", "railing-front-south"]);
    for (const [id, y] of [["railing-front-north", mm(8325)], ["railing-front-south", mm(6525)]] as const) {
      const r = rail(id)!;
      expect(r.start).toEqual({ x: mm(-880), y });
      expect(r.end).toEqual({ x: mm(0), y });
      expect([r.startBase, r.endBase, r.height]).toEqual([mm(150), mm(600), mm(900)]);
      const g = railingGeometry(r);
      expect(g.run).toBe(880);
      expect(g.posts).toHaveLength(7);
      expect([g.posts[0]!.base, g.posts[0]!.top]).toEqual([150, 1050]);
      expect([g.posts.at(-1)!.base, g.posts.at(-1)!.top]).toEqual([600, 1500]);
    }
    const front = rail("railing-front-facade-south")!;
    expect(front.start).toEqual({ x: mm(-900), y: mm(6525) });
    expect(front.end).toEqual({ x: mm(-900), y: mm(900) });
    expect([front.startBase, front.endBase, front.height]).toEqual([undefined, undefined, mm(900)]);
    expect(railingGeometry(front).run).toBe(5625);
    expect(railingGeometry(front).posts).toHaveLength(37);
    expect(railingGeometry(front).rail.up.z).toBe(1); // level

    const corner = rail("railing-front-corner")!;
    expect(corner.start).toEqual({ x: mm(0), y: mm(0) });
    expect(corner.end).toEqual({ x: mm(-900), y: mm(0) });
    expect([corner.startBase, corner.endBase, corner.height]).toEqual([undefined, undefined, mm(900)]);
    expect(railingGeometry(corner).run).toBe(900);
    expect(railingGeometry(corner).posts).toHaveLength(7);
    expect(railingGeometry(corner).rail.up.z).toBe(1); // level
  });

  it("draws all four railings on the street plan, with ids when asked, but none on the ground plan", () => {
    const plan = renderPlan(elmstead, street, { ids: false });
    for (const id of ["railing-front-north", "railing-front-south", "railing-front-facade-south", "railing-front-corner"]) {
      expect(plan).toContain(`class="railing" data-id="${id}"`);
    }
    expect(plan).toContain(`stroke="${C.railing}"`);
    expect(plan.indexOf("railing-front-facade-south")).toBeLessThan(plan.indexOf('class="stair"'));
    expect(renderPlan(elmstead, street, { ids: true })).toContain(">railing-front-facade-south<");
    expect(renderPlan(elmstead, ground, { ids: false })).not.toContain("railing-front");
  });
});

describe("Elmstead's basement", () => {
  it("projects the slab 900 mm beyond the front wall, out to the pavement edge", () => {
    const basement = elmstead.storeys.find((s) => s.id === "storey-basement")!;
    const slab = basement.slabs.find((s) => s.id === "slab-basement")!;
    expect(Math.min(...slab.outline.map((p) => p.x))).toBe(mm(-900));
    expect(contains(slab.outline, { x: mm(-450), y: mm(1000) })).toBe(true); // out past the west wall
    expect(contains(slab.outline, { x: mm(-901), y: mm(1000) })).toBe(false);
    expect(Math.min(...slab.outline.map((p) => p.y))).toBe(mm(0)); // south edge unchanged
    expect(Math.max(...slab.outline.map((p) => p.x))).toBe(extEastX); // still covers the extension
  });
});

describe("Elmstead's basement external stair", () => {
  const basement = elmstead.storeys.find((s) => s.id === "storey-basement")!;
  const street = elmstead.storeys.find((s) => s.id === "storey-street")!;
  const stair = basement.stairs?.find((s) => s.id === "stair-basement-external")!;

  it("climbs six steps to a 900 mm square top landing at the corner", () => {
    expect(stair.toStoreyId).toBe(street.id);
    expect(stair.segments.map((s) => s.kind)).toEqual(["flight", "landing"]);
    const [flight, landing] = stair.segments;
    if (flight?.kind !== "flight" || landing?.kind !== "landing") throw new Error("The external stair needs a flight and a top landing");
    expect(flight.risers).toBe(6);
    expect(flight.width).toBe(mm(900));
    expect(flight.start).toEqual({ x: mm(-450), y: mm(2400) });
    expect(flight.end).toEqual({ x: mm(-450), y: mm(900) });
    const footprint = flightFootprint(flight);
    expect(Math.min(...footprint.map((p) => p.x))).toBe(mm(-900)); // fills the external path
    expect(Math.max(...footprint.map((p) => p.x))).toBe(mm(0));
    expect(landing.outline).toEqual([
      { x: mm(-900), y: mm(0) },
      { x: mm(0), y: mm(0) },
      { x: mm(0), y: mm(900) },
      { x: mm(-900), y: mm(900) },
    ]);
    expect(landing.thickness).toBe(mm(150));
  });

  it("derives seven risers and leaves the last rise from the landing to the street", () => {
    const levels = stairLevels(stair, street.elevation - basement.elevation);
    expect(levels.totalRisers).toBe(7);
    expect(levels.riser).toBeCloseTo(1950 / 7, 9);
    const [flight, landing] = levels.segments;
    if (flight?.kind !== "flight" || landing?.kind !== "landing") throw new Error("The external stair needs a flight and a top landing");
    expect(flight.run).toBe(1500);
    expect(flight.going).toBe(300);
    expect(flight.top).toBeCloseTo((1950 * 6) / 7, 9);
    expect(landing.level).toBeCloseTo((1950 * 6) / 7, 9);
    expect(street.elevation - basement.elevation - landing.level).toBeCloseTo(levels.riser, 9);
  });
});

describe("Elmstead's external works", () => {
  it("passes the model checks", () => {
    expect(checkModel(elmstead)).toEqual([]);
  });

  it("renders the street plan with the ground fill and the front steps", () => {
    const street = elmstead.storeys.find((s) => s.id === "storey-street");
    if (!street) throw new Error("Elmstead needs the street storey");
    const plan = renderPlan(elmstead, street, { ids: false });
    expect(plan).toContain(`fill="${C.ground}"`);
    expect(plan).toContain('class="stair-flight" data-id="stair-flight-front"');
    expect(renderFloor(street).svg).toContain(`fill="${C.ground}"`);
  });

  it("wraps the pavement round the south-west corner and along the south wall, clear of the footprint", () => {
    const street = elmstead.storeys.find((s) => s.id === "storey-street")!;
    const pavement = street.slabs!.find((s) => s.id === "slab-external-ground")!;
    expect(contains(pavement.outline, { x: mm(-1200), y: mm(1200) })).toBe(true); // front apron
    expect(contains(pavement.outline, { x: mm(-1200), y: mm(-1200) })).toBe(true); // round the corner
    expect(contains(pavement.outline, { x: coreW - 1200, y: mm(-1200) })).toBe(true); // along the south wall
    expect(contains(pavement.outline, { x: coreW - 1200, y: mm(1200) })).toBe(false); // not under the house
  });
});