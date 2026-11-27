import { inStorey, jamb, mm } from "../../src/constraints/index.js";

const width = {
  id: "window-living-width",
  from: jamb("window-living", "start"),
  to: jamb("window-living", "end"),
  measure: "straight",
  distance: mm(1200),
  tolerence: mm(5),
};
export default [inStorey("storey-ground", [width as never])];
