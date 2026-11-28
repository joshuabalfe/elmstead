import { describe, expect, it } from "vitest";
import { convexOverlap, polygonProblems, spans } from "../src/shared/geometry/polygon.js";

const P = (x: number, y: number) => ({ x, y });
// L shape: 0..4000 wide at the bottom, 0..1000 wide above y = 2000.
const ell = [P(0, 0), P(4000, 0), P(4000, 2000), P(1000, 2000), P(1000, 3000), P(0, 3000)];

describe("spans", () => {
  it("finds where a horizontal or vertical line crosses the outline", () => {
    expect(spans(ell, "y", 1000)).toEqual([[0, 4000]]);
    expect(spans(ell, "y", 2500)).toEqual([[0, 1000]]);
    expect(spans(ell, "x", 500)).toEqual([[0, 3000]]);
    expect(spans(ell, "x", 3000)).toEqual([[0, 2000]]);
  });

  it("gives two spans where a concave outline is crossed twice", () => {
    const u = [
      P(0, 0),
      P(3000, 0),
      P(3000, 2000),
      P(2000, 2000),
      P(2000, 1000),
      P(1000, 1000),
      P(1000, 2000),
      P(0, 2000),
    ];
    expect(spans(u, "y", 1500)).toEqual([
      [0, 1000],
      [2000, 3000],
    ]);
  });

  it("is empty outside the outline and handles sloping edges", () => {
    expect(spans(ell, "y", 3500)).toEqual([]);
    expect(spans([P(0, 0), P(2000, 0), P(0, 2000)], "y", 500)).toEqual([[0, 1500]]);
  });
});

describe("polygonProblems", () => {
  it("accepts convex and concave outlines", () => {
    expect(polygonProblems([P(0, 0), P(1000, 0), P(1000, 1000), P(0, 1000)])).toEqual([]);
    expect(polygonProblems(ell)).toEqual([]);
  });

  it("reports an outline that repeats its first point", () => {
    expect(polygonProblems([P(0, 0), P(1000, 0), P(1000, 1000), P(0, 0)])).toContain(
      "outline repeats its first point at the end",
    );
  });

  it("reports repeated adjacent and too few distinct points", () => {
    expect(polygonProblems([P(0, 0), P(1000, 0), P(1000, 1000), P(1000, 1000)])).toContain(
      "outline repeats adjacent points",
    );
    expect(polygonProblems([P(0, 0), P(1000, 0), P(0, 0)])).toContain("outline needs at least 3 distinct points");
  });

  it("reports zero area", () => {
    expect(polygonProblems([P(0, 0), P(1000, 0), P(2000, 0)])).toContain("outline has zero area");
  });

  it("reports a bow-tie that crosses itself", () => {
    expect(polygonProblems([P(0, 0), P(1000, 1000), P(1000, 0), P(0, 1000)])).toContain("outline crosses itself");
  });

  it("reports a point repeated at a non-adjacent position", () => {
    expect(polygonProblems([P(0, 0), P(1000, 0), P(1000, 1000), P(0, 0), P(-1000, 1000)])).toContain(
      "outline repeats a point",
    );
  });

  it("reports a vertex that lies on a non-adjacent edge", () => {
    expect(polygonProblems([P(0, 0), P(1000, 0), P(1000, 1000), P(500, 0), P(0, 1000)])).toContain(
      "outline crosses itself",
    );
  });

  it("reports collinear non-adjacent edges that overlap", () => {
    expect(polygonProblems([P(0, 0), P(1000, 0), P(1000, 1000), P(800, 0), P(200, 0), P(0, 1000)])).toContain(
      "outline crosses itself",
    );
  });

  it("reports adjacent edges that double back", () => {
    expect(polygonProblems([P(0, 0), P(1000, 0), P(500, 0), P(500, 1000)])).toContain("outline doubles back on itself");
  });

  it("allows a straight continuation at an intermediate vertex", () => {
    expect(polygonProblems([P(0, 0), P(500, 0), P(1000, 0), P(1000, 1000), P(0, 1000)])).toEqual([]);
  });
});

describe("convexOverlap", () => {
  const square = (x: number, y: number, size = 1000) => [
    P(x, y),
    P(x + size, y),
    P(x + size, y + size),
    P(x, y + size),
  ];

  it("finds two squares that share area", () => {
    expect(convexOverlap(square(0, 0), square(500, 500))).toBe(true);
    expect(convexOverlap(square(0, 0), square(100, 100, 100))).toBe(true);
  });

  it("does not count squares that only touch along an edge or at a corner", () => {
    expect(convexOverlap(square(0, 0), square(1000, 0))).toBe(false);
    expect(convexOverlap(square(0, 0), square(1000, 1000))).toBe(false);
    expect(convexOverlap(square(0, 0), square(1000, 500))).toBe(false);
  });

  it("does not count squares apart", () => {
    expect(convexOverlap(square(0, 0), square(1500, 0))).toBe(false);
  });

  it("treats a 1 mm overlap as an overlap", () => {
    expect(convexOverlap(square(0, 0), square(999, 0))).toBe(true);
  });

  it("works for a turned rectangle", () => {
    const diamond = [P(1500, 1000), P(2000, 1500), P(1500, 2000), P(1000, 1500)];
    expect(convexOverlap(square(0, 0), diamond)).toBe(false);
    expect(
      convexOverlap(
        square(0, 0),
        diamond.map((p) => P(p.x - 400, p.y - 400)),
      ),
    ).toBe(true);
    // a corner of the diamond touches the square's edge
    expect(
      convexOverlap(
        square(0, 0),
        diamond.map((p) => P(p.x, p.y - 1000)),
      ),
    ).toBe(false);
  });

  it("is the same whichever polygon comes first, and either winding", () => {
    const a = square(0, 0);
    const b = square(500, 500);
    expect(convexOverlap(b, a)).toBe(true);
    expect(convexOverlap([...a].reverse(), b)).toBe(true);
  });
});
