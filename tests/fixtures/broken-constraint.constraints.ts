import { defineConstraints, inRoom, jamb, mm } from "../../src/constraints/index.js";

// window-living is 1200 mm wide.
export default defineConstraints([
  inRoom("room-living", [{ id: "living-window-width", from: jamb("window-living", "start"), to: jamb("window-living", "end"), measure: { along: "wall-south" }, distance: mm(1100) }]),
]);
