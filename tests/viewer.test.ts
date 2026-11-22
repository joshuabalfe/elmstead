import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResolvedConstraint } from "../src/constraints/check.js";
import { constraintLabels } from "../viewer/constraints.js";
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