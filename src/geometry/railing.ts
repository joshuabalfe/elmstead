/**
 * Derived railing geometry. The model stores a straight plan run, the walking surface at each end
 * and the height of the rail top; everything here follows.
 *
 * Lengths are plain float millimetres, like the rest of src/geometry/. The rail solid is positioned
 * so its TOP surface sits at `height` above the walking surface; its centreline is half the rail
 * depth below that, measured perpendicular to the run.
 */
import type { Railing } from "../schema/schema.js";
import { len, toVec, unit, v, vsub, type Vec } from "./vec.js";

/** Rail section, mm: 50 across the run by 40 deep. */
export const RAIL_WIDTH = 50;
export const RAIL_DEPTH = 40;
/** Post section, mm. */
export const POST_SIZE = 40;
/** Greatest spacing between post centres, mm; dense enough to read as balusters. */
export const MAX_POST_SPACING = 160;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const v3sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const v3scale = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k);
const v3len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const v3cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/** Plan distance from start to end. Zero is a model-check ERROR. */
export const railingRun = (r: Railing): number => len(vsub(toVec(r.end), toVec(r.start)));

/** Effective bases: an omitted base is 0. */
export const railingStartBase = (r: Railing): number => r.startBase ?? 0;
export const railingEndBase = (r: Railing): number => r.endBase ?? 0;

/** Walking-surface level at `t` from start (0) to end (1), relative to the storey floor. */
export const railingBaseAt = (r: Railing, t: number): number => railingStartBase(r) + (railingEndBase(r) - railingStartBase(r)) * t;

/** Post centres as fractions from start (0) to end (1), both ends included. */
export function railingPostFractions(r: Railing): number[] {
  const run = railingRun(r);
  if (run === 0) throw new Error(`${r.id}: zero-run railing has no post positions`);
  const intervals = Math.max(1, Math.ceil(run / MAX_POST_SPACING));
  return Array.from({ length: intervals + 1 }, (_, i) => i / intervals);
}

/** Post centres in plan coordinates, both ends included. */
export function railingPostPoints(r: Railing): Vec[] {
  const a = toVec(r.start);
  const b = toVec(r.end);
  return railingPostFractions(r).map((t) => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
}

export interface RailingPost {
  /** Plan centre. */
  at: Vec;
  /** Bottom (walking surface) and top (rail top) levels, relative to the storey floor. */
  base: number;
  top: number;
}

export interface RailingRail {
  /** Centreline start: the top surface is half the rail depth from here along `up`. */
  start: Vec3;
  end: Vec3;
  length: number;
  /** Extrusion direction, from start to end. */
  direction: Vec3;
  /** Horizontal direction across the run: the profile's local X. */
  across: Vec3;
  /** The profile's local Y; its Z component is positive, and the top surface is +20 mm along it. */
  up: Vec3;
}

export interface RailingGeometry {
  run: number;
  startBase: number;
  endBase: number;
  rail: RailingRail;
  posts: RailingPost[];
  /** Rail plus posts, mm³; the post/rail overlap is counted in both, matching the IFC body's solids. */
  volume: number;
}

/**
 * The rail line and every post. Throws for a zero plan run, which the model checks report before
 * anything is written.
 */
export function railingGeometry(r: Railing): RailingGeometry {
  const run = railingRun(r);
  if (run === 0) throw new Error(`${r.id}: zero-run railing cannot be written to IFC`);
  const startBase = railingStartBase(r);
  const endBase = railingEndBase(r);
  const planDir = unit(vsub(toVec(r.end), toVec(r.start)));
  const topStart = v3(r.start.x, r.start.y, startBase + r.height);
  const topEnd = v3(r.end.x, r.end.y, endBase + r.height);
  const delta = v3sub(topEnd, topStart);
  const length = v3len(delta);
  const direction = v3scale(delta, 1 / length);
  // Local X is horizontal across the run; local Y = Z × X points up, with Z-component run/length.
  const across = v3(-planDir.y, planDir.x, 0);
  const up = v3cross(direction, across);
  // Lower the centreline by half the rail depth so the TOP surface lies on the top line.
  const start = v3sub(topStart, v3scale(up, RAIL_DEPTH / 2));
  const end = v3sub(topEnd, v3scale(up, RAIL_DEPTH / 2));
  const posts = railingPostFractions(r).map((t) => {
    const base = railingBaseAt(r, t);
    return { at: v(r.start.x + (r.end.x - r.start.x) * t, r.start.y + (r.end.y - r.start.y) * t), base, top: base + r.height };
  });
  const volume = length * RAIL_WIDTH * RAIL_DEPTH + posts.length * POST_SIZE * POST_SIZE * r.height;
  return { run, startBase, endBase, rail: { start, end, length, direction, across, up }, posts, volume };
}
