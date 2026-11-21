import { openingExtent } from "../geometry/opening.js";
import { faceOffsets, wallDirection, wallLength, wallPoint } from "../geometry/wall.js";
import { cross, dot, len, perpLeft, toVec, v, vadd, vscale, vsub, type Vec } from "../geometry/vec.js";
import type { BuildingModel, Opening, Room, Wall } from "../schema/schema.js";
import type { Constraint, CornerPoint, Face, Measure, Point, RoomCornerPoint } from "./schema.js";

/** A constraint that cannot be measured: a missing id, a face a wall does not have, and so on. */
export class ConstraintError extends Error {}

const fail = (message: string): never => {
  throw new ConstraintError(message);
};

interface Entry {
  kind: string;
  /** The storey an element is on; undefined for the project, site, building and components. */
  storey?: string;
  element: unknown;
}

/** Every id in the model, with its kind and storey. Ids are unique model-wide, so one map will do. */
export type ModelIndex = Map<string, Entry>;

export function indexModel(model: BuildingModel): ModelIndex {
  const ix: ModelIndex = new Map();
  const add = (id: string, entry: Entry) => {
    if (!ix.has(id)) ix.set(id, entry); // a duplicate is reported by checkIds
  };
  add(model.project.id, { kind: "project", element: model.project });
  add(model.site.id, { kind: "site", element: model.site });
  add(model.building.id, { kind: "building", element: model.building });
  for (const c of model.components?.doors ?? []) add(c.id, { kind: "door component", element: c });
  for (const c of model.components?.windows ?? []) add(c.id, { kind: "window component", element: c });
  for (const s of model.storeys) {
    add(s.id, { kind: "storey", storey: s.id, element: s });
    for (const w of s.walls) add(w.id, { kind: "wall", storey: s.id, element: w });
    for (const o of s.openings) add(o.id, { kind: o.kind, storey: s.id, element: o });
    for (const sl of s.slabs) add(sl.id, { kind: "slab", storey: s.id, element: sl });
    for (const r of s.rooms) add(r.id, { kind: "room", storey: s.id, element: r });
  }
  return ix;
}

/** An element found by id, checked to be one of `kinds`; `label` names what was wanted in the error. */
export function lookup<T>(ix: ModelIndex, id: string, kinds: readonly string[], label: string): { element: T; storey: string } {
  const entry = ix.get(id) ?? fail(`${id} is not in the model`);
  if (!kinds.includes(entry.kind) || entry.storey === undefined) fail(`${id} is a ${entry.kind}, not ${/^[aeiou]/.test(label) ? "an" : "a"} ${label}`);
  return { element: entry.element as T, storey: entry.storey! };
}

const wallOf = (ix: ModelIndex, id: string) => {
  const found = lookup<Wall>(ix, id, ["wall"], "wall");
  if (wallLength(found.element) === 0) fail(`${id} has zero length`);
  return found;
};

const NORMALS = { north: v(0, 1), south: v(0, -1), east: v(1, 0), west: v(-1, 0) } as const;

/**
 * Which side of the wall a face is, looking from start to end. A compass face is accepted only on a
 * wall running along plan x or y, and only for the two sides it has.
 */
export function faceSide(w: Wall, face: Face): "left" | "right" {
  if (face === "left" || face === "right") return face;
  const d = wallDirection(w);
  if (d.x !== 0 && d.y !== 0) fail(`${w.id} is not axis-aligned, so it has no ${face} face: name its face left or right`);
  const side = dot(perpLeft(d), NORMALS[face]);
  if (side === 0) fail(`${w.id} runs ${d.x === 0 ? "north–south" : "east–west"}, so it has no ${face} face`);
  return side > 0 ? "left" : "right";
}

/** Offset of a wall face from the wall's start→end line, positive to the left. */
export const faceOffset = (w: Wall, face: Face): number => faceOffsets(w)[faceSide(w, face)];

const COMPASS = { "north-east": v(1, 1), "north-west": v(-1, 1), "south-east": v(1, -1), "south-west": v(-1, -1) } as const;

/** A room outline vertex: the one furthest in a compass direction (a tie within 1 mm is an error), or by number. */
export function roomVertex(room: Room, corner: keyof typeof COMPASS | number): Vec {
  if (typeof corner === "number") {
    const p = room.outline[corner] ?? fail(`${room.id} has ${room.outline.length} vertices, numbered 0 to ${room.outline.length - 1}`);
    return toVec(p);
  }
  const scores = room.outline.map((p) => dot(toVec(p), COMPASS[corner]));
  const best = Math.max(...scores);
  const furthest = room.outline.filter((_, i) => best - scores[i]! <= 1);
  if (furthest.length > 1) fail(`${room.id} has ${furthest.length} vertices equally far to the ${corner}: name a vertex number instead`);
  return toVec(furthest[0]!);
}

/** What a constraint's group is scoped to. */
export interface Scope {
  kind: "storey" | "room";
  id: string;
  /** The storey every point must be on. */
  storey: string;
}

interface Resolved {
  at: Vec;
  /** The model ids the point was found from, and their storeys. */
  refs: { id: string; storey: string }[];
}

const isWallCorner = (p: Point): p is CornerPoint => "corner" in p && Array.isArray(p.corner);
const isRoomCorner = (p: Point): p is RoomCornerPoint => "corner" in p && !Array.isArray(p.corner);

export function resolvePoint(ix: ModelIndex, p: Point, scope: Scope): Resolved {
  if (isWallCorner(p)) {
    const [a, b] = p.corner.map(({ wall, face }) => {
      const { element: w, storey } = wallOf(ix, wall);
      return { origin: wallPoint(w, 0, faceOffset(w, face)), d: wallDirection(w), ref: { id: wall, storey } };
    }) as [{ origin: Vec; d: Vec; ref: Resolved["refs"][number] }, { origin: Vec; d: Vec; ref: Resolved["refs"][number] }];
    const denom = cross(a.d, b.d);
    if (Math.abs(denom) < 1e-9) fail(`the faces of ${a.ref.id} and ${b.ref.id} are parallel, so they do not meet`);
    const t = cross(vsub(b.origin, a.origin), b.d) / denom;
    return { at: vadd(a.origin, vscale(a.d, t)), refs: [a.ref, b.ref] };
  }
  if (isRoomCorner(p)) {
    const id = p.room ?? (scope.kind === "room" ? scope.id : fail("a room corner outside a room group needs a room"));
    const { element: room, storey } = lookup<Room>(ix, id, ["room"], "room");
    return { at: roomVertex(room, p.corner), refs: [{ id, storey }] };
  }
  if ("wall" in p) {
    const { element: w, storey } = wallOf(ix, p.wall);
    const along = p.end === "start" ? 0 : wallLength(w);
    return { at: wallPoint(w, along, p.face ? faceOffset(w, p.face) : 0), refs: [{ id: p.wall, storey }] };
  }
  const { element: o, storey } = lookup<Opening>(ix, p.opening, ["door", "window"], "opening");
  const host = wallOf(ix, o.wallId).element;
  const side = p.face ? faceSide(host, p.face) : undefined;
  const across = side ? faceOffsets(host)[side] : 0;
  // On a face the jambs are where the reveal meets it: further apart on a splayed face.
  const [start, end] = side ? openingExtent(host, o, side) : [o.offsetAlongWall, o.offsetAlongWall + o.width];
  const along = p.at === "start" ? start : p.at === "end" ? end : o.offsetAlongWall + o.width / 2;
  return { at: wallPoint(host, along, across), refs: [{ id: p.opening, storey }] };
}

/** Unsigned distance between two points, as the constraint says it was measured. */
export function measure(ix: ModelIndex, a: Vec, b: Vec, m: Measure): { distance: number; refs: Resolved["refs"] } {
  const d = vsub(b, a);
  if (m === "straight") return { distance: len(d), refs: [] };
  if (m === "x" || m === "y") return { distance: Math.abs(d[m]), refs: [] };
  const { element: w, storey } = wallOf(ix, m.along);
  return { distance: Math.abs(dot(d, wallDirection(w))), refs: [{ id: m.along, storey }] };
}

/** Every element a constraint names must be on the scope's storey. */
function checkStorey(refs: Resolved["refs"], scope: Scope): void {
  const storeys = [...new Set(refs.map((r) => r.storey))];
  if (storeys.length > 1) fail(`its points are on different storeys: ${storeys.join(" and ")}`);
  const away = refs.find((r) => r.storey !== scope.storey);
  if (away) fail(`${away.id} is not on ${scope.kind === "room" ? "the room's storey" : "the group's storey"}, ${scope.storey}`);
}

/** The constraint's measured distance, rounded to the nearest mm. Throws ConstraintError if it cannot be measured. */
export function measureConstraint(ix: ModelIndex, c: Constraint, scope: Scope): number {
  const from = resolvePoint(ix, c.from, scope);
  const to = resolvePoint(ix, c.to, scope);
  const m = measure(ix, from.at, to.at, c.measure);
  checkStorey([...from.refs, ...to.refs, ...m.refs], scope);
  return Math.round(m.distance);
}
