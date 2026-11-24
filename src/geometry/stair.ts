/**
 * Derived stair geometry. Nothing here is stored in the model: the rise comes from the two storeys
 * and everything else follows from the segment order and the flights' riser counts.
 *
 * Lengths are plain float millimetres, like the rest of src/geometry/. They must not go through
 * `mm()`, `div()` or `divRound()`: a 3050 mm rise over 16 risers is 190.625 mm, and rounding it to
 * 191 would put the top of the stair 6 mm past the storey it climbs to.
 */
import type { Stair, StairFlight, StairLanding } from "../schema/schema.js";
import { area } from "./polygon.js";
import { len, perpLeft, toVec, unit, v, vadd, vscale, vsub, type Vec } from "./vec.js";

/** A flight's derived levels, relative to the containing storey's floor. */
export interface FlightLevel {
  kind: "flight";
  segment: StairFlight;
  /** Level the flight leaves from. */
  base: number;
  /** Level it arrives at: base + risers × riser height. */
  top: number;
  /** Plan distance from start to end. */
  run: number;
  /** Tread depth: run / (risers - 1), so the last riser lands on the next segment. */
  going: number;
}

/** A landing's derived level; it is flat, so this is both its bottom of rise and its top. */
export interface LandingLevel {
  kind: "landing";
  segment: StairLanding;
  level: number;
}

export type SegmentLevel = FlightLevel | LandingLevel;

export interface StairLevels {
  /** Total rise between the two storeys. */
  rise: number;
  /** Height of one riser, shared by every flight in the stair. */
  riser: number;
  totalRisers: number;
  segments: SegmentLevel[];
}

/**
 * Walk a stair's segments from its containing storey's floor, in mm relative to it, to the
 * elevation of the storey it climbs to. Callers run the model checks first: a stair with no flights
 * has no risers to divide the rise by.
 */
export function stairLevels(stair: Stair, rise: number): StairLevels {
  const totalRisers = stair.segments.reduce((n, s) => (s.kind === "flight" ? n + s.risers : n), 0);
  const riser = rise / totalRisers;
  const segments: SegmentLevel[] = [];
  let level = 0;
  for (const segment of stair.segments) {
    if (segment.kind === "landing") {
      segments.push({ kind: "landing", segment, level });
      continue;
    }
    const run = flightRun(segment);
    segments.push({ kind: "flight", segment, base: level, top: level + segment.risers * riser, run, going: run / (segment.risers - 1) });
    level += segment.risers * riser;
  }
  return { rise, riser, totalRisers, segments };
}

/** Plan distance from a flight's start to its end. Zero for a degenerate flight, which checks reject. */
export const flightRun = (f: StairFlight): number => len(vsub(toVec(f.end), toVec(f.start)));

/** Unit vector along a flight, from start to end. Undefined for a zero-length flight. */
export const flightDirection = (f: StairFlight): Vec => unit(vsub(toVec(f.end), toVec(f.start)));

/**
 * A flight's plan footprint: the rectangle from start to end, `width` across, centred on the
 * start→end line so the walking line runs up the middle.
 */
export function flightFootprint(f: StairFlight): Vec[] {
  const n = perpLeft(flightDirection(f));
  const half = f.width / 2;
  const a = toVec(f.start);
  const b = toVec(f.end);
  return [vadd(a, vscale(n, -half)), vadd(b, vscale(n, -half)), vadd(b, vscale(n, half)), vadd(a, vscale(n, half))];
}

/** A line across a flight, from one edge of its footprint to the other, at `along` from its start. */
export function flightCrossLine(f: StairFlight, along: number): { from: Vec; to: Vec } {
  const d = flightDirection(f);
  const n = perpLeft(d);
  const half = f.width / 2;
  const p = vadd(toVec(f.start), vscale(d, along));
  return { from: vadd(p, vscale(n, -half)), to: vadd(p, vscale(n, half)) };
}

/**
 * The tread nosing lines the plan draws, one per tread: at each going from the start, excluding the
 * first riser, which is the footprint's own start edge.
 */
export function flightTreads(f: StairFlight, going: number): { from: Vec; to: Vec }[] {
  return Array.from({ length: f.risers - 1 }, (_, i) => flightCrossLine(f, (i + 1) * going));
}

/**
 * The flight's side profile in (along, up) millimetres from its base: the stepped top the treads
 * make, then a flat tapered soffit back to the base at the near end, so the flight is a hollow waist
 * rather than a solid block. `waist` is the soffit's vertical depth below the top at the far end. The
 * final riser is a vertical face rather than a step, because the segment above it — a landing or the
 * storey — provides the surface you step onto. Counter-clockwise, like every other profile.
 */
export function flightProfile(f: StairFlight, going: number, riser: number, waist = 150): Vec[] {
  const pts: Vec[] = [v(0, 0)];
  for (let k = 1; k < f.risers; k++) {
    pts.push(v((k - 1) * going, k * riser));
    pts.push(v(k * going, k * riser));
  }
  // Never let the soffit sink below the flight's base on a short rise.
  const w = Math.min(waist, (f.risers - 1) * riser);
  pts.push(v((f.risers - 1) * going, (f.risers - 1) * riser - w));
  return pts.reverse();
}

/** Profile area in mm², for the round-trip's expected flight volume. */
export const flightProfileArea = (f: StairFlight, going: number, riser: number, waist = 150): number => area(flightProfile(f, going, riser, waist));

/** The turning angle, in degrees, between two consecutive flights' plan directions. */
export function turnBetween(a: StairFlight, b: StairFlight): number {
  const d1 = flightDirection(a);
  const d2 = flightDirection(b);
  const cos = Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y));
  return (Math.acos(cos) * 180) / Math.PI;
}
