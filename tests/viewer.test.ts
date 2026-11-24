import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResolvedConstraint } from "../src/constraints/check.js";
import { constraintLabels } from "../viewer/constraints.js";
import { CLICK_SLOP_PX, SNAP_MAX_PX, axisAlignedPoint, isMeasureGesture, measurementLines, measurementSummary, measurementValues, nearestSnap } from "../viewer/measure.js";
import { confinedPath } from "../viewer/serve.js";
import { parseView } from "../viewer/view.js";

const dir = "/tmp/elmstead-out";

describe("confinedPath", () => {
  it("serves a file inside the directory", () => {
    expect(confinedPath(dir, "cottage.ifc")).toBe(resolve(dir, "cottage.ifc"));
    expect(confinedPath(dir, "nested/cottage.ifc")).toBe(resolve(dir, "nested/cottage.ifc"));
  });

  it("rejects traversal, sibling prefixes and absolute paths", () => {
    expect(confinedPath(dir, "../out-x/secret.ifc")).toBeUndefined();
    expect(confinedPath(dir, "%2e%2e/out-x/secret.ifc")).toBeUndefined();
    expect(confinedPath(dir, "/etc/passwd")).toBeUndefined();
  });

  it("rejects malformed percent-encoding without throwing", () => {
    expect(confinedPath(dir, "%E0%A4%A")).toBeUndefined();
  });
});

describe("parseView", () => {
  it("accepts the five camera views and falls back to top", () => {
    for (const view of ["sw", "se", "ne", "nw", "top"] as const) expect(parseView(view)).toBe(view);
    expect(parseView("sideways")).toBe("top");
    expect(parseView(null)).toBe("top");
  });
});

type Pt = [number, number];
const point = ([x, y]: Pt) => ({ x, y });
const constraint = (id: string, from: Pt, to: Pt, distance: number, storey = "storey-ground", span: { from: Pt; to: Pt } = { from, to }): ResolvedConstraint => ({
  id,
  scope: "room-living",
  storey,
  from: point(from),
  to: point(to),
  span: { from: point(span.from), to: point(span.to) },
  distance,
});

describe("constraintLabels", () => {
  it("labels a storey's constraints at their midpoint with id and distance", () => {
    expect(constraintLabels([constraint("living-width", [200, 200], [3750, 3350], 3550)], "storey-ground")).toEqual([
      { at: { x: 1975, y: 1775 }, lines: ["living-width 3550"] },
    ]);
    expect(constraintLabels([constraint("first-floor", [0, 0], [1000, 1000], 1000, "storey-first")], "storey-ground")).toEqual([]);
  });

  it("uses the measured span's midpoint for an x or y constraint", () => {
    expect(
      constraintLabels([constraint("living-width", [200, 200], [3750, 3350], 3550, "storey-ground", { from: [200, 200], to: [3750, 200] })], "storey-ground"),
    ).toEqual([{ at: { x: 1975, y: 200 }, lines: ["living-width 3550"] }]);
  });

  it("stacks constraints that share a midpoint in one label", () => {
    expect(
      constraintLabels(
        [
          constraint("living-width", [200, 200], [3750, 3350], 3550),
          constraint("living-depth", [200, 200], [3750, 3350], 4200),
          constraint("front-length", [0, 0], [8000, 0], 8000),
        ],
        "storey-ground",
      ),
    ).toEqual([
      { at: { x: 1975, y: 1775 }, lines: ["living-width 3550", "living-depth 4200"] },
      { at: { x: 4000, y: 0 }, lines: ["front-length 8000"] },
    ]);
  });
});

describe("measurementValues", () => {
  it("computes straight, horizontal and vertical distances in millimetres", () => {
    expect(measurementValues({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 })).toEqual({ straightMm: 5000, horizontalMm: 5000, verticalMm: 0 });
    expect(measurementValues({ x: 1, y: 2, z: 3 }, { x: 1, y: 4.5, z: 3 })).toEqual({ straightMm: 2500, horizontalMm: 0, verticalMm: 2500 });
    const mixed = measurementValues({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 4 });
    expect(mixed.straightMm).toBeCloseTo(Math.sqrt(41) * 1000);
    expect(mixed.horizontalMm).toBeCloseTo(5000);
    expect(mixed.verticalMm).toBeCloseTo(4000);
  });
});

describe("measurement display", () => {
  it("rounds the scene label and the list row to whole millimetres", () => {
    const values = { straightMm: 3450.4, horizontalMm: 3400.5, verticalMm: 249.6 };
    expect(measurementLines(1, values)).toEqual(["M1 3450 mm", "horizontal 3401 mm", "vertical 250 mm"]);
    expect(measurementSummary(1, values)).toBe("M1 3450 mm · plan 3401 mm · rise 250 mm");
  });
});

describe("axisAlignedPoint", () => {
  const from = { x: 1, y: 2, z: 3 };

  it("projects onto the dominant plan axis", () => {
    expect(axisAlignedPoint(from, { x: 4, y: 2.2, z: 3.4 })).toEqual({ x: 4, y: 2, z: 3 });
    expect(axisAlignedPoint(from, { x: 1.2, y: 2.1, z: 7 })).toEqual({ x: 1, y: 2, z: 7 });
  });

  it("projects onto a vertical line when the height change dominates", () => {
    expect(axisAlignedPoint(from, { x: 1.5, y: 5, z: 3.4 })).toEqual({ x: 1, y: 5, z: 3 });
  });

  it("breaks ties in X, then Z, then Y order", () => {
    expect(axisAlignedPoint({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 0 })).toEqual({ x: 2, y: 0, z: 0 });
    expect(axisAlignedPoint({ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 2 })).toEqual({ x: 0, y: 0, z: 2 });
  });
});

describe("nearestSnap", () => {
  it("chooses the nearest candidate in screen space", () => {
    const edge = { x: 10, y: 0, point: false, at: "edge" };
    const corner = { x: 12, y: 0, point: true, at: "corner" };
    expect(nearestSnap([corner, edge], { x: 0, y: 0 })?.at).toBe("edge");
  });

  it("prefers a corner only when the distances tie", () => {
    const edge = { x: -5, y: 0, point: false, at: "edge" };
    const corner = { x: 5, y: 0, point: true, at: "corner" };
    expect(nearestSnap([edge, corner], { x: 0, y: 0 })?.at).toBe("corner");
  });

  it("ignores candidates beyond the snap cut-off", () => {
    const near = { x: SNAP_MAX_PX, y: 0, point: false, at: "near" };
    const far = { x: SNAP_MAX_PX + 1, y: 0, point: false, at: "far" };
    expect(nearestSnap([near], { x: 0, y: 0 })?.at).toBe("near");
    expect(nearestSnap([far], { x: 0, y: 0 })).toBeUndefined();
    expect(nearestSnap([], { x: 0, y: 0 })).toBeUndefined();
  });
});

describe("isMeasureGesture", () => {
  it("accepts a click or tap within the slop and rejects a drag", () => {
    expect(CLICK_SLOP_PX).toBe(4);
    expect(isMeasureGesture({ x: 0, y: 0 }, { x: CLICK_SLOP_PX, y: 0 })).toBe(true);
    expect(isMeasureGesture({ x: 10, y: 10 }, { x: 8, y: 9 })).toBe(true);
    expect(isMeasureGesture({ x: 0, y: 0 }, { x: CLICK_SLOP_PX + 0.01, y: 0 })).toBe(false);
    expect(isMeasureGesture({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
  });
});