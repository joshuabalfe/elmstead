/**
 * Derived stair geometry. Nothing here is stored in the model: the rise comes from the two storeys
 * and everything else follows from the segment order and the flights' riser counts.
 *
 * Lengths are plain float millimetres, like the rest of src/geometry/. They must not go through
 * `mm()`, `div()` or `divRound()`: a 3050 mm rise over 16 risers is 190.625 mm, and rounding it to
 * 191 would put the top of the stair 6 mm past the storey it climbs to.
 */
import type { Stair, StairFlight, StairLanding, StairWinder } from "../schema/schema.js";
import { area } from "./polygon.js";
import { cross, dot, len, perpLeft, toVec, unit, v, vadd, vscale, vsub, type Vec } from "./vec.js";

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

/**
 * A winder's derived levels. Tread k, from 1, is at `base + k × riser`, so `top` is its last tread's
 * level, which is also where the flight after it starts from.
 */
export interface WinderLevel {
  kind: "winder";
  segment: StairWinder;
  base: number;
  top: number;
}

export type SegmentLevel = FlightLevel | LandingLevel | WinderLevel;

export interface StairLevels {
  /** Total rise between the two storeys. */
  rise: number;
  /** Height of one riser, shared by every flight in the stair and the final rise off a top landing. */
  riser: number;
  totalRisers: number;
  segments: SegmentLevel[];
}

/**
 * Walk a stair's segments from its containing storey's floor, in mm relative to it, to the
 * elevation of the storey it climbs to. A stair ending in a top landing has one further riser from
 * that landing onto the storey. A winder's risers count with the flights': it owns its entry and
 * interior riser lines, and the flight after it owns the riser at the winder's exit edge. Callers run
 * the model checks first: a stair with no flights has no risers to divide the rise by.
 */
export function stairLevels(stair: Stair, rise: number): StairLevels {
  const topLanding = stair.segments.at(-1)?.kind === "landing";
  const totalRisers =
    stair.segments.reduce((n, s) => (s.kind === "landing" ? n : n + s.risers), 0) + (topLanding ? 1 : 0);
  const riser = rise / totalRisers;
  const segments: SegmentLevel[] = [];
  let level = 0;
  for (const segment of stair.segments) {
    if (segment.kind === "landing") {
      segments.push({ kind: "landing", segment, level });
      continue;
    }
    if (segment.kind === "winder") {
      segments.push({ kind: "winder", segment, base: level, top: level + segment.risers * riser });
      level += segment.risers * riser;
      continue;
    }
    const run = flightRun(segment);
    segments.push({
      kind: "flight",
      segment,
      base: level,
      top: level + segment.risers * riser,
      run,
      going: run / (segment.risers - 1),
    });
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
export const flightProfileArea = (f: StairFlight, going: number, riser: number, waist = 150): number =>
  area(flightProfile(f, going, riser, waist));

/** The turning angle, in degrees, between two consecutive flights' plan directions. */
export function turnBetween(a: StairFlight, b: StairFlight): number {
  const d1 = flightDirection(a);
  const d2 = flightDirection(b);
  const cos = Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y));
  return (Math.acos(cos) * 180) / Math.PI;
}

// ── Winders ───────────────────────────────────────────────────────────────────

/** Points closer than this, in mm, are one point: a fan line can end exactly on an outline corner. */
const SAME = 1e-6;

/** A winder's outline read against its pivot and entry. */
export interface WinderFrame {
  pivot: Vec;
  /** The outline point beside the pivot where the walker steps on. */
  entry: Vec;
  /** The other outline point beside the pivot, where the walker steps off. */
  exit: Vec;
  /** The outline from `entry` round to `exit`, not passing through the pivot. */
  chain: Vec[];
  /** The interior angle at the pivot, in degrees: how far the fan turns. */
  turn: number;
  /** +1 when the walker turns left (counter-clockwise in plan), -1 when right. */
  sign: 1 | -1;
}

const same = (a: Vec, b: Vec): boolean => Math.abs(a.x - b.x) < SAME && Math.abs(a.y - b.y) < SAME;

/**
 * Read a winder's outline against its pivot and entry, or say why it can't be read: the pivot is not
 * an outline point, the entry is not beside it, or the pivot is not a corner. The model checks report
 * these, so geometry callers that run after them can take the frame as given.
 */
export function winderFrame(w: StairWinder): WinderFrame | string {
  const pts = w.outline.map(toVec);
  const n = pts.length;
  const pivot = toVec(w.pivot);
  const entry = toVec(w.entry);
  const i = pts.findIndex((p) => same(p, pivot));
  if (i < 0) return "the pivot is not one of the outline's points";
  const next = (i + 1) % n;
  const prev = (i + n - 1) % n;
  let step: 1 | -1;
  if (same(pts[next]!, entry)) step = 1;
  else if (same(pts[prev]!, entry)) step = -1;
  else return "the entry is not beside the pivot on the outline";
  const exitIndex = step === 1 ? prev : next;
  const chain: Vec[] = [];
  for (let k = step === 1 ? next : prev; ; k = (k + n + step) % n) {
    chain.push(pts[k]!);
    if (k === exitIndex) break;
  }
  const exit = pts[exitIndex]!;
  const ue = unit(vsub(entry, pivot));
  const ux = unit(vsub(exit, pivot));
  const turn = (Math.acos(Math.max(-1, Math.min(1, dot(ue, ux)))) * 180) / Math.PI;
  const c = cross(ue, ux);
  if (!(Math.abs(c) > 1e-9)) return "the pivot is not a corner of the outline";
  return { pivot, entry, exit, chain, turn, sign: c > 0 ? 1 : -1 };
}

/** A winder's derived plan geometry. */
export interface WinderFan {
  frame: WinderFrame;
  /** The N−1 interior fan lines, from the pivot to where each meets the outline. */
  rays: { from: Vec; to: Vec }[];
  /** The N treads in walking order: tread k, from 1, is `treads[k − 1]`, at k risers above the base. */
  treads: Vec[][];
  /** From the middle of the entry edge through the middle of each fan line to the middle of the exit edge. */
  walkingLine: Vec[];
}

const rotate = (a: Vec, degrees: number): Vec => {
  const t = (degrees * Math.PI) / 180;
  return v(a.x * Math.cos(t) - a.y * Math.sin(t), a.x * Math.sin(t) + a.y * Math.cos(t));
};

/**
 * Fan a winder out: N−1 lines from the pivot at equal angles between the entry and exit edges, each
 * running to where it leaves the outline, and the N treads they cut it into. Tread k is the pivot, the
 * point where fan line k−1 ends, any outline corners between that and the end of fan line k, and the
 * end of fan line k; the entry and exit edges are fan lines 0 and N. A fan line that ends on a corner
 * shares it with its neighbours rather than repeating it.
 */
export function winderFan(w: StairWinder): WinderFan {
  const frame = winderFrame(w);
  if (typeof frame === "string") throw new Error(`${w.id}: ${frame}`);
  const { pivot, entry, exit, chain, turn, sign } = frame;
  const n = w.risers;
  const along: number[] = [0]; // arc length to each chain point
  for (let k = 1; k < chain.length; k++) along.push(along[k - 1]! + len(vsub(chain[k]!, chain[k - 1]!)));
  const ue = unit(vsub(entry, pivot));

  /** Each fan line's end and how far along the chain it is. */
  const ends: { at: Vec; s: number }[] = [{ at: entry, s: 0 }];
  for (let k = 1; k < n; k++) {
    const d = rotate(ue, sign * turn * (k / n));
    let hit: { at: Vec; s: number } | undefined;
    for (let j = 0; j + 1 < chain.length && !hit; j++) {
      const a = chain[j]!;
      const e = vsub(chain[j + 1]!, a);
      const den = cross(d, e);
      if (Math.abs(den) < 1e-12) continue;
      const t = cross(vsub(a, pivot), e) / den;
      const u = cross(vsub(a, pivot), d) / den;
      if (t > SAME && u > -1e-9 && u < 1 + 1e-9)
        hit = { at: vadd(pivot, vscale(d, t)), s: along[j]! + Math.min(1, Math.max(0, u)) * len(e) };
    }
    if (!hit) throw new Error(`${w.id}: fan line ${k} does not leave the outline`);
    ends.push(hit);
  }
  ends.push({ at: exit, s: along[along.length - 1]! });

  const treads: Vec[][] = [];
  for (let k = 1; k <= n; k++) {
    const from = ends[k - 1]!;
    const to = ends[k]!;
    const pts: Vec[] = [pivot, from.at];
    chain.forEach((c, j) => {
      if (along[j]! > from.s + SAME && along[j]! < to.s - SAME) pts.push(c);
    });
    pts.push(to.at);
    treads.push(pts.filter((p, j) => j === 0 || !same(p, pts[j - 1]!)));
  }
  const mid = (p: Vec): Vec => vscale(vadd(pivot, p), 0.5);
  return {
    frame,
    rays: ends.slice(1, -1).map((e) => ({ from: pivot, to: e.at })),
    treads,
    walkingLine: ends.map((e) => mid(e.at)),
  };
}
