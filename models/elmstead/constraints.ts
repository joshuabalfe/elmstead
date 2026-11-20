/**
 * Elmstead: measurements the model must keep, checked by every command. Only real measurements go
 * here, each with a note saying where it came from; positions traced from the plan image do not.
 *
 * When one fails, fix the model, not the constraint. Change a constraint only for a new measurement.
 */
import { corner, defineConstraints, inRoom, jamb, m, mm, roomCorner } from "../../src/constraints/index.js";

export default defineConstraints([
  inRoom("room-living", [
    {
      id: "living-width",
      note: "Living room size from the owner (5.8 x 4.2 m): the 4.2 m side, west to east",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "x",
      distance: m(4.2),
    },
    {
      id: "living-depth",
      note: "Living room size from the owner (5.8 x 4.2 m): the 5.8 m side, from the chimney breast to the hall wall",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "y",
      distance: m(5.8),
    },
    {
      id: "front-window-width",
      note: "Front window size from the owner",
      from: jamb("window-living", "start"),
      to: jamb("window-living", "end"),
      measure: { along: "wall-west" },
      distance: m(2.5),
    },
  ]),
  inRoom("room-bedroom", [
    {
      id: "bedroom-width",
      note: "Bedroom size from the owner (3.3 x 3.8 m): the 3.8 m side, west to east",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "x",
      distance: m(3.8),
    },
    {
      id: "bedroom-depth",
      note: "Bedroom size from the owner (3.3 x 3.8 m): the 3.3 m side, from the thickened south wall to the bathroom wall",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "y",
      distance: m(3.3),
    },
  ]),
  inRoom("room-bathroom", [
    {
      id: "bathroom-width",
      note: "Bathroom size from the owner (1.6 x 2.9 m): the 2.9 m side, west to east",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "x",
      distance: m(2.9),
    },
    {
      id: "bathroom-depth",
      note: "Bathroom size from the owner (1.6 x 2.9 m): the 1.6 m side, south to north",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "y",
      distance: m(1.6),
    },
  ]),
  inRoom("room-hallway", [
    {
      id: "hallway-width",
      note: "Hallway width from the owner",
      from: corner({ wall: "wall-hall-living", face: "north" }, { wall: "wall-west", face: "east" }),
      to: corner({ wall: "wall-north", face: "south" }, { wall: "wall-west", face: "east" }),
      measure: "y",
      distance: m(1.5),
    },
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
