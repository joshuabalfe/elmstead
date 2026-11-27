import { defineConstraints, inStorey, jamb, mm } from "../../../src/constraints/index.js";

export default defineConstraints([
  inStorey("storey-ground", [
    {
      id: "window-living-width",
      from: jamb("window-living", "start"),
      to: jamb("window-living", "end"),
      measure: { along: "wall-south" },
      distance: mm(1200),
    },
  ]),
]);
