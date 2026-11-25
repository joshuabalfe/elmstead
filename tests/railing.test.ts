import { describe, expect, it } from "vitest";
import { POST_SIZE, RAIL_DEPTH, RAIL_WIDTH, railingGeometry, railingPostFractions, railingPostPoints, railingRun } from "../src/geometry/railing.js";
import { m, mm, pt, railing } from "../src/model/index.js";

const level = railing("railing-level", pt(mm(0), mm(0)), pt(m(3), mm(0)), { height: mm(900) });
const sloped = railing("railing-sloped", pt(mm(0), mm(0)), pt(mm(880), mm(0)), { height: mm(900), startBase: mm(150), endBase: mm(600) });

describe("railing geometry", () => {
  it("measures the plan run and spaces posts at most 160 mm apart", () => {
    expect(railingRun(level)).toBe(3000);
    const fractions = railingPostFractions(level);
    expect(fractions).toHaveLength(20); // 19 intervals over 3 m
    expect(fractions[0]).toBe(0);
    expect(fractions.at(-1)).toBe(1);
    const points = railingPostPoints(level);
    expect(points).toHaveLength(20);
    expect(points[0]!.x).toBe(0);
    expect(points.at(-1)!.x).toBe(3000);
    expect(Math.max(...points.slice(1).map((p, i) => p.x - points[i]!.x))).toBeLessThanOrEqual(160 + 1e-9);
    expect(railingPostFractions(sloped)).toHaveLength(7); // 6 intervals over 880 mm
  });

  it("puts the rail's top surface at height above a level run", () => {
    const g = railingGeometry(level);
    expect(g.rail.length).toBe(3000);
    expect(g.rail.direction).toEqual({ x: 1, y: 0, z: 0 });
    expect(g.rail.up.z).toBeCloseTo(1, 12);
    expect(g.rail.start.z).toBeCloseTo(900 - RAIL_DEPTH / 2, 12);
    expect(g.rail.end.z).toBeCloseTo(g.rail.start.z, 12);
    expect(g.posts).toHaveLength(20);
    for (const p of g.posts) expect([p.base, p.top]).toEqual([0, 900]);
    expect(g.volume).toBe(3000 * RAIL_WIDTH * RAIL_DEPTH + 20 * POST_SIZE * POST_SIZE * 900);
  });

  it("slopes the rail between the bases and keeps its top at height", () => {
    const g = railingGeometry(sloped);
    const length = Math.hypot(880, 450);
    const verticalDrop = (RAIL_DEPTH / 2) * (880 / length);
    expect(g.rail.length).toBeCloseTo(length, 9);
    expect(g.rail.direction.x).toBeCloseTo(880 / length, 12);
    expect(g.rail.direction.z).toBeCloseTo(450 / length, 12);
    expect(g.rail.start.z).toBeCloseTo(150 + 900 - verticalDrop, 9);
    expect(g.rail.end.z).toBeCloseTo(600 + 900 - verticalDrop, 9);
    expect(g.posts).toHaveLength(7);
    expect([g.posts[0]!.base, g.posts[0]!.top]).toEqual([150, 1050]);
    expect([g.posts.at(-1)!.base, g.posts.at(-1)!.top]).toEqual([600, 1500]);
    expect(g.volume).toBeCloseTo(length * RAIL_WIDTH * RAIL_DEPTH + 7 * POST_SIZE * POST_SIZE * 900, 6);
  });

  it("keeps the rail within 10 mm of 900 above the front flight's nosings", () => {
    const g = railingGeometry(sloped);
    // The nosing line is 150 mm at the flight start, 0.5 mm per mm up the run, and the rail starts
    // 20 mm up the flight; the initial 10 mm gap narrows to 0 at the top.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = 880 * t;
      const top = g.rail.start.z + (g.rail.end.z - g.rail.start.z) * t + verticalTopOffset(g);
      const nosing = 150 + 0.5 * (20 + x);
      expect(top - nosing).toBeGreaterThanOrEqual(889.9);
      expect(top - nosing).toBeLessThanOrEqual(900.1);
    }
  });

  it("rejects a zero plan run", () => {
    const zero = railing("railing-zero", pt(mm(0), mm(0)), pt(mm(0), mm(0)), { height: mm(900) });
    expect(railingRun(zero)).toBe(0);
    expect(() => railingPostFractions(zero)).toThrow(/zero-run/);
    expect(() => railingGeometry(zero)).toThrow(/zero-run/);
  });
});

/** The vertical offset from the rail centreline to its top at the start. */
const verticalTopOffset = (g: ReturnType<typeof railingGeometry>): number => (RAIL_DEPTH / 2) * g.rail.up.z;
