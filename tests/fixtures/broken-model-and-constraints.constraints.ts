import { defineConstraints, inRoom, jamb, mm } from "../../src/constraints/index.js";

const width = {
  from: jamb("window-living", "start"),
  to: jamb("window-living", "end"),
  measure: { along: "wall-south" },
} as const;
export default defineConstraints([
  inRoom("room-living", [
    { id: "too-narrow", ...width, distance: mm(1100) },
    { id: "too-wide", ...width, distance: mm(1300) },
  ]),
]);
