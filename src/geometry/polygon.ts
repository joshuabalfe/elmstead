import { cross, dot, vsub, type Vec } from "./vec.js";

/** Signed area (mm²), positive for counter-clockwise outlines. The outline is implicitly closed. */
export function signedArea(pts: readonly Vec[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export const area = (pts: readonly Vec[]): number => Math.abs(signedArea(pts));

/** Area centroid; falls back to the vertex average for degenerate outlines. */
export function centroid(pts: readonly Vec[]): Vec {
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) {
    const n = pts.length;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(pts: readonly Vec[]): Bounds {
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

/** Proper intersection of segments ab and cd (shared endpoints and collinear touching excluded). */
export function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const d1 = cross(vsub(b, a), vsub(c, a));
  const d2 = cross(vsub(b, a), vsub(d, a));
  const d3 = cross(vsub(d, c), vsub(a, c));
  const d4 = cross(vsub(d, c), vsub(b, c));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Reasons an outline is not a simple polygon; empty for a valid concave or convex outline. */
export function polygonProblems(pts: readonly Vec[]): string[] {
  const problems: string[] = [];
  const same = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y;
  const closed = pts.length > 1 && same(pts[0]!, pts[pts.length - 1]!);
  if (closed) problems.push("outline repeats its first point at the end");
  const body = closed ? pts.slice(0, -1) : pts;
  const distinct = new Set(body.map((p) => `${p.x},${p.y}`));
  if (distinct.size < 3) problems.push("outline needs at least 3 distinct points");
  else if (distinct.size < body.length) problems.push("outline repeats a point");
  for (let i = 0; i < body.length - 1; i++) {
    if (same(body[i]!, body[i + 1]!)) {
      problems.push("outline repeats adjacent points");
      break;
    }
  }
  if (distinct.size >= 3 && area(body) === 0) problems.push("outline has zero area");

  const touch = (a: Vec, b: Vec, c: Vec, d: Vec): boolean =>
    segmentsCross(a, b, c, d) || onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b);
  const n = body.length;
  for (let i = 0; i < n; i++) {
    const a = body[i]!;
    const b = body[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      const c = body[j]!;
      const d = body[(j + 1) % n]!;
      if (j === i + 1 || (i === 0 && j === n - 1)) {
        // Adjacent edges share a vertex; they only overlap when they double back along the same ray.
        const shared = j === i + 1 ? b : a;
        const first = j === i + 1 ? a : b;
        const second = j === i + 1 ? d : c;
        if (!same(shared, first) && !same(shared, second) && collinear(shared, first, second) && dot(vsub(first, shared), vsub(second, shared)) > 0) {
          problems.push("outline doubles back on itself");
          return problems;
        }
        continue;
      }
      if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) continue; // reported as a repeated point
      if (touch(a, b, c, d)) {
        problems.push("outline crosses itself");
        return problems;
      }
    }
  }
  return problems;
}

const near = 1e-6;
const collinear = (a: Vec, b: Vec, c: Vec): boolean => Math.abs(cross(vsub(b, a), vsub(c, a))) <= near;

/** Whether p lies on segment ab, including its endpoints and collinear overlap. */
function onSegment(p: Vec, a: Vec, b: Vec): boolean {
  if (!collinear(a, b, p)) return false;
  return p.x >= Math.min(a.x, b.x) - near && p.x <= Math.max(a.x, b.x) + near && p.y >= Math.min(a.y, b.y) - near && p.y <= Math.max(a.y, b.y) + near;
}

/**
 * Where the line `axis = at` passes through the outline, as [from, to] spans along the other axis,
 * in increasing order. For axis "y" the line is horizontal and the spans are x ranges.
 */
export function spans(pts: readonly Vec[], axis: "x" | "y", at: number): [number, number][] {
  const other = axis === "y" ? "x" : "y";
  const hits: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    // Half-open test so a line through a vertex is counted once.
    if (p[axis] <= at !== q[axis] <= at) hits.push(p[other] + ((at - p[axis]) * (q[other] - p[other])) / (q[axis] - p[axis]));
  }
  hits.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) out.push([hits[i]!, hits[i + 1]!]);
  return out;
}
