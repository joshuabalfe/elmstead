import { describe, expect, it } from "vitest";
import { wallHeight, wallSideArea, wallTopAt, wallTopMin } from "../src/shared/geometry/wall.js";
import { mm, pt, wall } from "../src/backend/model/index.js";

const flat = wall("wall-flat", pt(mm(0), mm(0)), pt(mm(4000), mm(0)), { thickness: mm(200), height: mm(2400) });
const gable = wall("wall-gable", pt(mm(0), mm(0)), pt(mm(4000), mm(0)), {
  thickness: mm(200),
  profile: [
    { along: mm(0), up: mm(1200) },
    { along: mm(2000), up: mm(2600) },
    { along: mm(4000), up: mm(1200) },
  ],
});
const gableToFloor = wall("wall-gable-floor", pt(mm(0), mm(0)), pt(mm(4000), mm(0)), {
  thickness: mm(200),
  profile: [
    { along: mm(0), up: mm(0) },
    { along: mm(2000), up: mm(3200) },
    { along: mm(4000), up: mm(0) },
  ],
});

describe("wall top edge", () => {
  it("reads a flat wall as a level edge at its height", () => {
    expect(wallHeight(flat)).toBe(2400);
    expect(wallTopMin(flat, 500, 1500)).toBe(2400);
    expect(wallSideArea(flat)).toBe(4000 * 2400);
  });

  it("reads a gable's height, slope and side area", () => {
    expect(wallHeight(gable)).toBe(2600);
    expect(wallTopAt(gable, 1000)).toBe(1900); // halfway up the west slope
    expect(wallTopMin(gable, 100, 1300)).toBe(1270); // lowest at the near jamb
    expect(wallTopMin(gable, 1400, 2600)).toBe(2180); // symmetric about the ridge
    expect(wallSideArea(gable)).toBe(4000 * 1200 + ((2600 - 1200) * 4000) / 2);
  });

  it("clips a gable that runs to the floor into a triangle", () => {
    expect(wallHeight(gableToFloor)).toBe(3200);
    expect(wallTopMin(gableToFloor, 0, 4000)).toBe(0);
    expect(wallSideArea(gableToFloor)).toBe((4000 * 3200) / 2);
  });
});
