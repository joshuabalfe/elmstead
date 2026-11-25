import type { Wall } from "../schema/schema.js";
import { area } from "./polygon.js";
import { len, perpLeft, toVec, unit, v, vadd, vscale, vsub, type Vec } from "./vec.js";

export const wallLength = (w: Wall): number => len(vsub(toVec(w.end), toVec(w.start)));

/** Unit vector from start to end. Undefined for zero-length walls; callers check first. */
export const wallDirection = (w: Wall): Vec => unit(vsub(toVec(w.end), toVec(w.start)));

/** Signed offsets of the wall's two faces from its start→end line, positive to the left. */
export function faceOffsets(w: Wall): { left: number; right: number } {
  const t = w.thickness;
  switch (w.justification) {
    case "left":
      return { left: t, right: 0 };
    case "right":
      return { left: 0, right: -t };
    case "centre":
      return { left: t / 2, right: -t / 2 };
  }
}

/** Point at distance `along` from the wall start, offset `across` to the left of the wall line. */
export function wallPoint(w: Wall, along: number, across: number): Vec {
  const d = wallDirection(w);
  return vadd(toVec(w.start), vadd(vscale(d, along), vscale(perpLeft(d), across)));
}

/** Footprint of a stretch of wall between two distances along it (e.g. an opening cut). */
export function wallSegmentFootprint(w: Wall, from: number, to: number): Vec[] {
  const { left, right } = faceOffsets(w);
  return [wallPoint(w, from, right), wallPoint(w, to, right), wallPoint(w, to, left), wallPoint(w, from, left)];
}

/** The wall's top edge in (along, up) mm: a pitched wall's profile, or a level edge at its height. */
export function wallTopEdge(w: Wall): Vec[] {
  if (w.profile) return w.profile.map((p) => v(p.along, p.up));
  const h = w.height ?? 0;
  return [v(0, h), v(wallLength(w), h)];
}

/** The wall's effective height: the highest point of its top edge. */
export function wallHeight(w: Wall): number {
  return Math.max(...wallTopEdge(w).map((p) => p.y));
}

/** Height of the top edge at a distance along the wall, linear between profile points. */
export function wallTopAt(w: Wall, along: number): number {
  const edge = wallTopEdge(w);
  if (along <= edge[0]!.x) return edge[0]!.y;
  for (let i = 1; i < edge.length; i++) {
    const a = edge[i - 1]!;
    const b = edge[i]!;
    if (along <= b.x) return a.y + ((b.y - a.y) * (along - a.x)) / (b.x - a.x);
  }
  return edge[edge.length - 1]!.y;
}

/** Lowest top-edge height over [from, to] along the wall: an opening must fit under this. */
export function wallTopMin(w: Wall, from: number, to: number): number {
  let min = Math.min(wallTopAt(w, from), wallTopAt(w, to));
  for (const p of wallTopEdge(w)) if (p.x > from && p.x < to) min = Math.min(min, p.y);
  return min;
}

/**
 * Closed side elevation in (along, up): the base, then the top edge back, counter-clockwise. Where
 * the top edge meets the floor (up 0) at an end or a flat band, that stretch is clipped off, so a
 * gable running right down to the floor is a clean triangle rather than a degenerate polygon with
 * repeated or collinear corners.
 */
export function wallSideProfile(w: Wall): Vec[] {
  const edge = wallTopEdge(w);
  const positive = edge.map((p, i) => ({ p, i })).filter(({ p }) => p.y > 0);
  if (!positive.length) return [v(0, 0), v(wallLength(w), 0)];
  const first = positive[0]!;
  const last = positive[positive.length - 1]!;
  const a = first.i > 0 && edge[first.i - 1]!.y === 0 ? edge[first.i - 1]!.x : first.p.x;
  const b = last.i < edge.length - 1 && edge[last.i + 1]!.y === 0 ? edge[last.i + 1]!.x : last.p.x;
  return [v(a, 0), v(b, 0), ...edge.slice(first.i, last.i + 1).reverse()];
}

/** Area of the wall's side elevation in mm²: length × height for a flat wall. */
export function wallSideArea(w: Wall): number {
  return area(wallSideProfile(w));
}
