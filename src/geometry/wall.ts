import type { Wall } from "../schema/schema.js";
import { len, perpLeft, toVec, unit, vadd, vscale, vsub, type Vec } from "./vec.js";

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
