import { cross, vsub, type Vec } from "./vec.js";

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
