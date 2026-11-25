/**
 * Authoring helpers for model files. These only build plain schema values; they hold no state.
 * Everything here is optional sugar: a model can always write the JSON shape out by hand.
 */
import { SCHEMA_VERSION, type BuildingModel, type Door, type DoorComponent, type Point, type Polygon, type Railing, type Reveal, type Room, type Stair, type StairFlight, type StairLanding, type StairSegment, type Storey, type Swing, type Wall, type Window, type WindowComponent } from "../schema/schema.js";
import { faceOffsets, wallDirection, wallLength } from "../geometry/wall.js";
import { add, divRound, mm, sub, type Mm } from "../schema/units.js";

export const pt = (x: Mm, y: Mm): Point => ({ x, y });

/** Identity function that fills in schemaVersion and gives model files full type checking. */
export const defineBuilding = (b: Omit<BuildingModel, "schemaVersion">): BuildingModel => ({
  schemaVersion: SCHEMA_VERSION,
  ...b,
});

type WallOpts = Pick<Wall, "thickness"> & Partial<Pick<Wall, "height" | "profile" | "justification" | "name">>;

export function wall(id: string, start: Point, end: Point, opts: WallOpts): Wall {
  return {
    id,
    ...(opts.name === undefined ? {} : { name: opts.name }),
    start,
    end,
    thickness: opts.thickness,
    ...(opts.height === undefined ? {} : { height: opts.height }),
    ...(opts.profile === undefined ? {} : { profile: opts.profile }),
    justification: opts.justification ?? "centre",
  };
}

export interface RectWalls {
  south: Wall;
  east: Wall;
  north: Wall;
  west: Wall;
}

/**
 * Four external walls whose OUTER faces form the rectangle [x0, x0+width] × [y0, y0+depth].
 * Walls run counter-clockwise with the body to the left (inside). South and north walls run the
 * full width; east and west walls butt between them, so corners neither overlap nor leave gaps.
 */
export function rectWalls(
  idPrefix: string,
  origin: Point,
  width: Mm,
  depth: Mm,
  opts: Pick<Wall, "thickness" | "height">,
): RectWalls {
  const { x: x0, y: y0 } = origin;
  const x1 = add(x0, width);
  const y1 = add(y0, depth);
  const t = opts.thickness;
  const o = { ...opts, justification: "left" as const };
  return {
    south: wall(`${idPrefix}-south`, pt(x0, y0), pt(x1, y0), o),
    east: wall(`${idPrefix}-east`, pt(x1, add(y0, t)), pt(x1, sub(y1, t)), o),
    north: wall(`${idPrefix}-north`, pt(x1, y1), pt(x0, y1), o),
    west: wall(`${idPrefix}-west`, pt(x0, sub(y1, t)), pt(x0, add(y0, t)), o),
  };
}

type Compass = "north" | "south" | "east" | "west";

/**
 * Coordinate of one face of an axis-aligned wall: the y of its north/south face for an east–west
 * wall, the x of its east/west face for a north–south wall. Throws for diagonal walls or a side
 * the wall does not have (e.g. the east face of an east–west wall).
 */
export function face(w: Wall, side: Compass): Mm {
  const d = wallDirection(w);
  const { left, right } = faceOffsets(w);
  const horizontal = d.y === 0 && d.x !== 0;
  const vertical = d.x === 0 && d.y !== 0;
  if (horizontal && (side === "north" || side === "south")) {
    // left normal of an eastward wall points north
    const ys = [w.start.y + d.x * left, w.start.y + d.x * right];
    return mm(side === "north" ? Math.max(...ys) : Math.min(...ys));
  }
  if (vertical && (side === "east" || side === "west")) {
    // left normal of a northward wall points west
    const xs = [w.start.x - d.y * left, w.start.x - d.y * right];
    return mm(side === "east" ? Math.max(...xs) : Math.min(...xs));
  }
  throw new Error(`face(${w.id}, ${side}): wall is not axis-aligned in a way that has a ${side} face`);
}

/**
 * Where one face of a wall, in any direction, crosses the line x = `at` (axis "x") or y = `at`
 * (axis "y"), rounded to the mm: the corner a room outline needs where it meets a diagonal wall.
 * `side` is the face to the left or right of the wall, looking from its start to its end. Throws if
 * the face runs along the line, so never crosses it.
 */
export function faceCrossing(w: Wall, side: "left" | "right", axis: "x" | "y", at: Mm): Point {
  const d = wallDirection(w);
  if (Math.abs(d[axis]) < 1e-9) throw new Error(`faceCrossing(${w.id}, ${side}, ${axis} = ${at}): the face runs along that line`);
  const offset = faceOffsets(w)[side];
  // A point on the face (offset along the left normal), then along the wall to the line.
  const o = { x: w.start.x - d.y * offset, y: w.start.y + d.x * offset };
  const t = (at - o[axis]) / d[axis];
  return pt(mm(Math.round(o.x + d.x * t)), mm(Math.round(o.y + d.y * t)));
}

/** Rectangular room between four plan coordinates (typically wall faces from `face()`). */
export function rectRoom(id: string, name: string, b: { west: Mm; east: Mm; south: Mm; north: Mm }): Room {
  return {
    id,
    name,
    outline: [pt(b.west, b.south), pt(b.east, b.south), pt(b.east, b.north), pt(b.west, b.north)],
  };
}

/**
 * offsetAlongWall for an opening of `width` centred on plan coordinate `at` — an x for east–west
 * walls, a y for north–south walls. Handles walls drawn in either direction.
 */
export function centredOn(w: Wall, at: Mm, width: Mm): Mm {
  const d = wallDirection(w);
  const startCoord = d.y === 0 ? w.start.x : d.x === 0 ? w.start.y : undefined;
  if (startCoord === undefined) throw new Error(`centredOn(${w.id}): wall is not axis-aligned`);
  const sign = d.y === 0 ? Math.sign(d.x) : Math.sign(d.y);
  const centreAlong = (at - startCoord) * sign;
  if (centreAlong < 0 || centreAlong > wallLength(w)) {
    throw new Error(`centredOn(${w.id}, ${at}): point is beyond the wall`);
  }
  return sub(mm(centreAlong), divRound(width, 2));
}

type OpeningSize = Pick<Door, "width" | "height">;

/** A door design (see `components` in the schema), for `door()`, optionally with a frame. */
export const doorComponent = (id: string, name: string, detail: Omit<DoorComponent, "id" | "name"> = {}): DoorComponent => ({ id, name, ...detail });
/** A window design (see `components` in the schema), for `window()`, optionally with glazing bars. */
export const windowComponent = (id: string, name: string, detail: Omit<WindowComponent, "id" | "name"> = {}): WindowComponent => ({ id, name, ...detail });

/**
 * A door, with `sillHeight` 0: `door(id, wall, offset, component, size, swing?)`, linked to the
 * component, or `door(id, wall, offset, size, swing?)` without one.
 */
export function door(id: string, w: Wall, offsetAlongWall: Mm, component: DoorComponent, size: OpeningSize, swing?: Swing): Door;
export function door(id: string, w: Wall, offsetAlongWall: Mm, size: OpeningSize, swing?: Swing): Door;
export function door(id: string, w: Wall, offsetAlongWall: Mm, a: DoorComponent | OpeningSize, b?: OpeningSize | Swing, c?: Swing): Door {
  const [component, size, swing] = "id" in a ? [a, b as OpeningSize, c] : [undefined, a, b as Swing | undefined];
  return {
    kind: "door",
    id,
    wallId: w.id,
    offsetAlongWall,
    ...(component ? { componentId: component.id } : {}),
    width: size.width,
    height: size.height,
    sillHeight: mm(0),
    ...(swing ? { swing } : {}),
  };
}

/** A doorway: a wall opening with no door leaf, frame or swing. */
export function doorway(id: string, w: Wall, offsetAlongWall: Mm, size: OpeningSize): Door {
  return { kind: "door", id, wallId: w.id, offsetAlongWall, width: size.width, height: size.height, sillHeight: mm(0), doorway: true };
}

/**
 * A window: `window(id, wall, offset, component, { width, height, sillHeight })`, linked to the
 * component, or `window(id, wall, offset, { width, height, sillHeight })` without one. A last
 * `reveal` splays its jambs.
 */
export function window(id: string, w: Wall, offsetAlongWall: Mm, component: WindowComponent, size: OpeningSize & Pick<Window, "sillHeight">, reveal?: Reveal): Window;
export function window(id: string, w: Wall, offsetAlongWall: Mm, size: OpeningSize & Pick<Window, "sillHeight">, reveal?: Reveal): Window;
export function window(id: string, w: Wall, offsetAlongWall: Mm, a: WindowComponent | (OpeningSize & Pick<Window, "sillHeight">), b?: (OpeningSize & Pick<Window, "sillHeight">) | Reveal, c?: Reveal): Window {
  const [component, size, reveal] = "id" in a ? [a, b as OpeningSize & Pick<Window, "sillHeight">, c] : [undefined, a, b as Reveal | undefined];
  return {
    kind: "window",
    id,
    wallId: w.id,
    offsetAlongWall,
    ...(component ? { componentId: component.id } : {}),
    width: size.width,
    height: size.height,
    sillHeight: size.sillHeight,
    ...(reveal ? { reveal } : {}),
  };
}

/** A straight run of steps, for `stair()`. Levels are derived, so only the plan geometry is given. */
export const stairFlight = (id: string, start: Point, end: Point, opts: Pick<StairFlight, "width" | "risers">): StairFlight => ({
  kind: "flight",
  id,
  start,
  end,
  width: opts.width,
  risers: opts.risers,
});

/** A flat platform between flights, or a stair's top landing, for `stair()`. Its level follows from the flights below it. */
export const stairLanding = (id: string, outline: Polygon, opts: Pick<StairLanding, "thickness">): StairLanding => ({
  kind: "landing",
  id,
  outline,
  thickness: opts.thickness,
});

/**
 * A stair climbing from its containing storey to `toStorey`, with `segments` in bottom-to-top
 * order. Holds no elevations, riser height or going: the rise comes from the two storeys and the
 * levels from the flights' riser counts (see src/geometry/stair.ts).
 */
export const stair = (id: string, toStorey: Storey, segments: StairSegment[]): Stair => ({
  id,
  toStoreyId: toStorey.id,
  segments,
});

export type RailingOpts = Pick<Railing, "height"> & Partial<Pick<Railing, "startBase" | "endBase">>;

/**
 * A straight railing run. `height` is to the top of the rail above the walking surface;
 * `startBase`/`endBase` are that surface at each end. Bases are recorded exactly as given and both
 * are omitted when neither is given; an omitted base means 0 (see the schema).
 */
export const railing = (id: string, start: Point, end: Point, opts: RailingOpts): Railing => ({
  id,
  start,
  end,
  height: opts.height,
  ...(opts.startBase === undefined ? {} : { startBase: opts.startBase }),
  ...(opts.endBase === undefined ? {} : { endBase: opts.endBase }),
});
