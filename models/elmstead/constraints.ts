/**
 * Elmstead: measurements the model must keep, checked by every command. Only real measurements go
 * here, each with a note saying where it came from; positions traced from the plan image do not.
 *
 * When one fails, fix the model, not the constraint. Change a constraint only for a new measurement.
 */
import { corner, defineConstraints, inRoom, inStorey, jamb, m, mm, roomCorner, wallEnd } from "../../src/constraints/index.js";

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
      note: "Bedroom size from the owner (3.3 x 3.85 m): the 3.85 m side, west to east",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "x",
      distance: m(3.85),
    },
    {
      id: "bedroom-depth",
      note: "Bedroom size from the owner (3.3 x 3.85 m): the 3.3 m side, from the thickened south wall to the bathroom wall",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "y",
      distance: m(3.3),
    },
  ]),
  inRoom("room-bathroom", [
    {
      id: "bathroom-width",
      note: "Bathroom size from the owner (1.6 x 2.85 m): the 2.85 m side, west to east",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "x",
      distance: m(2.85),
    },
    {
      id: "bathroom-depth",
      note: "Bathroom size from the owner (1.6 x 2.85 m): the 1.6 m side, south to north",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "y",
      distance: m(1.6),
    },
  ]),
  inRoom("room-lobby", [
    {
      id: "lobby-width",
      note: "Lobby width from the owner",
      from: corner({ wall: "wall-living-bedroom", face: "east" }, { wall: "wall-bedroom-bathroom", face: "north" }),
      to: corner({ wall: "wall-lobby-bathroom", face: "west" }, { wall: "wall-bedroom-bathroom", face: "north" }),
      measure: "x",
      distance: mm(865),
    },
  ]),
  inRoom("room-rear-hall", [
    {
      id: "rear-hall-depth",
      note: "Rear hall depth from the owner: 2 m, extension south wall to north wall",
      from: corner({ wall: "wall-extension-south", face: "north" }, { wall: "wall-extension-east", face: "west" }),
      to: corner({ wall: "wall-north", face: "south" }, { wall: "wall-extension-east", face: "west" }),
      measure: "y",
      distance: m(2),
    },
  ]),
  inStorey("storey-ground", [
    {
      id: "stair-flight-width",
      note: "Stair flight width from the owner (both flights 0.91 m); the north flight, spine to north wall",
      from: wallEnd("wall-stair-spine", "end", "north"),
      to: wallEnd("wall-north", "start", "south"),
      measure: "y",
      distance: mm(910),
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
