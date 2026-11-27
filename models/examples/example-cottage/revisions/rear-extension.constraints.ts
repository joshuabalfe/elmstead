/**
 * Example cottage, rear extension: how the proposal changes the cottage's measurements. Like the
 * cottage's own constraints these are illustrative; a real revision takes them from its drawings.
 */
import {
  addGroups,
  inRoom,
  jamb,
  mm,
  replaceConstraint,
  reviseConstraints,
  roomCorner,
} from "../../../../src/constraints/index.js";
import base from "../constraints.js";

export default reviseConstraints(base, [
  // The front window is 600 mm wider about the same centre, so its west jamb is 300 mm nearer the corner.
  replaceConstraint({
    ...base[0]!.constraints.find((c) => c.id === "living-corner-to-window")!,
    note: "illustrative: the proposal's wider window",
    distance: mm(875),
  }),
  replaceConstraint({
    ...base[0]!.constraints.find((c) => c.id === "living-window-width")!,
    note: "illustrative: the proposal's 1.8 m window",
    distance: mm(1800),
  }),
  addGroups(
    inRoom("room-lean-to", [
      {
        id: "lean-to-width",
        note: "illustrative: the proposal's lean-to, inside",
        from: roomCorner("south-west"),
        to: roomCorner("north-east"),
        measure: "x",
        distance: mm(3200),
      },
      {
        id: "lean-to-door-centre",
        note: "illustrative: the doorway is centred on the lean-to",
        from: roomCorner("south-west"),
        to: jamb("doorway-lean-to", "centre"),
        measure: "x",
        distance: mm(1600),
      },
    ]),
  ),
]);
