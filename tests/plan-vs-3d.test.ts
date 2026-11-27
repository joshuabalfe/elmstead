/**
 * The 3D viewer's Top view, in plan style, must show the same walls, rooms and openings as the
 * plan. Builds each model into a temporary folder, serves it with the viewer, reads the WebGL
 * canvas back and compares it with the plan's own pixels (tests/support/plan-vs-3d.ts).
 *
 * The viewer tests are split over several files so CI can run them on separate runners; they
 * share tests/support/viewer-page.ts. This one compares the example cottage and the two-storey
 * fixture; plan-vs-3d-elmstead.test.ts compares Elmstead, and viewer-storey-selection.test.ts has
 * the floor picker.
 */
import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import { C } from "../src/shared/render/style.js";
import { isIgnoredColour } from "./support/plan-vs-3d.js";
import { compareEveryStorey } from "./support/plan-compare.js";
import { useViewer } from "./support/viewer-page.js";

useViewer();

describe("plan colours", () => {
  it("ignores ground and railing pixels in the plan-versus-3D comparison", () => {
    expect(isIgnoredColour(C.ground)).toBe(true);
    expect(isIgnoredColour(C.railing)).toBe(true);
  });
});

describe("3D Top view against the plan", () => {
  compareEveryStorey([
    ["models/examples/example-cottage", cottage],
    ["tests/fixtures/two-storey", twoStorey],
  ]);
});
