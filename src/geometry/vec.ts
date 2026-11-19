import type { Point } from "../schema/schema.js";

/** Plain-number 2D vector maths. Geometry works in float mm; only the model stores integer Mm. */
export interface Vec {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const vadd = (a: Vec, b: Vec): Vec => v(a.x + b.x, a.y + b.y);
export const vsub = (a: Vec, b: Vec): Vec => v(a.x - b.x, a.y - b.y);
export const vscale = (a: Vec, k: number): Vec => v(a.x * k, a.y * k);
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const unit = (a: Vec): Vec => vscale(a, 1 / len(a));
/** Rotate 90° counter-clockwise: the left-hand normal of a direction. */
export const perpLeft = (a: Vec): Vec => v(-a.y, a.x);

export const toVec = (p: Point): Vec => v(p.x, p.y);
