import {
  addGroups,
  inRoom,
  jamb,
  mm,
  removeConstraint,
  replaceConstraint,
  reviseConstraints,
  roomCorner,
} from "../../../../../src/backend/constraints/index.js";
import base from "../../constraints.js";

export default reviseConstraints(base, [
  removeConstraint("living-corner-to-window", "the window is widened, so its west jamb moves"),
  replaceConstraint({
    id: "living-window-width",
    note: "illustrative: the proposal's 1.8 m window",
    from: jamb("window-living", "start"),
    to: jamb("window-living", "end"),
    measure: { along: "wall-south" },
    distance: mm(1800),
    tolerance: mm(0),
  }),
  addGroups(
    inRoom("room-living", [
      {
        id: "living-window-from-east",
        note: "illustrative",
        from: jamb("window-living", "end"),
        to: roomCorner("south-east"),
        measure: "x",
        distance: mm(875),
      },
    ]),
  ),
]);
