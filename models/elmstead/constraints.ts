/**
 * Elmstead: measurements the model must keep, checked by every command. Only real measurements go
 * here, each with a note saying where it came from; positions traced from the plan image do not.
 *
 * When one fails, fix the model, not the constraint. Change a constraint only for a new measurement.
 */
import { defineConstraints, inRoom, jamb, m, mm } from "../../src/constraints/index.js";

export default defineConstraints([
  inRoom("room-living", [
    {
      id: "front-window-width",
      note: "Front window size from the owner",
      from: jamb("window-living", "start"),
      to: jamb("window-living", "end"),
      measure: { along: "wall-west" },
      distance: m(2.5),
    },
  ]),
  inRoom("room-hallway", [
    {
      id: "fanlight-width",
      note: "Fanlight size from the owner",
      from: jamb("window-front-fanlight", "start"),
      to: jamb("window-front-fanlight", "end"),
      measure: { along: "wall-west" },
      distance: mm(900),
    },
  ]),
]);
