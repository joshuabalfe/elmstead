/**
 * Example cottage: measurements the model must keep, checked by every command. Between them they
 * use every kind of point and measure; see docs/modelling.md#constraints.
 *
 * When one fails, fix the model, not the constraint.
 */
import {
  corner,
  defineConstraints,
  inRoom,
  inStorey,
  jamb,
  m,
  mm,
  roomCorner,
  wallEnd,
} from "../../../src/backend/constraints/index.js";

const livingSouthWest = corner({ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" });

export default defineConstraints([
  inRoom("room-living", [
    {
      id: "living-corner-to-window",
      note: "Inside south-west corner to the window's west jamb, along the front wall",
      from: livingSouthWest,
      to: jamb("window-living", "start", "left"),
      measure: { along: "wall-south" },
      distance: mm(1175),
    },
    {
      id: "living-window-width",
      from: jamb("window-living", "start"),
      to: jamb("window-living", "end"),
      measure: { along: "wall-south" },
      distance: m(1.2),
      tolerance: mm(0),
    },
    {
      id: "living-width",
      from: roomCorner("south-west"),
      to: roomCorner("north-east"),
      measure: "x",
      distance: mm(3550),
    },
  ]),
  inRoom("room-hall", [
    {
      id: "hall-width",
      from: corner({ wall: "wall-hall-west", face: "east" }, { wall: "wall-south", face: "north" }),
      to: corner({ wall: "wall-hall-east", face: "west" }, { wall: "wall-south", face: "north" }),
      measure: { along: "wall-south" },
      distance: mm(1100),
    },
  ]),
  inRoom("room-bathroom", [
    {
      id: "bathroom-corner-to-window-centre",
      from: corner({ wall: "wall-east", face: "west" }, { wall: "wall-north", face: "south" }),
      to: jamb("window-bathroom", "centre", "west"),
      measure: "y",
      distance: mm(975),
    },
  ]),
  inStorey("storey-ground", [
    {
      id: "front-length",
      from: wallEnd("wall-south", "start"),
      to: wallEnd("wall-south", "end"),
      measure: "straight",
      distance: m(8),
    },
  ]),
]);
