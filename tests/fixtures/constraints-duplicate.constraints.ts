import { defineConstraints, inStorey, jamb, mm } from "../../src/constraints/index.js";

const width = { id: "window-living-width", from: jamb("window-living", "start"), to: jamb("window-living", "end"), measure: "straight", distance: mm(1200) } as const;
export default defineConstraints([inStorey("storey-ground", [width]), inStorey("storey-ground", [width])]);
