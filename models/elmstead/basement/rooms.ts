/** Basement rooms, outlined along the faces of the walls around them (./walls.ts). */
import { face, pt, rectRoom, type Room } from "../../../src/model/index.js";
import { coreW, extSouthY } from "../shared.js";
import {
  bedroomDivide,
  breastSouth,
  central,
  eastIn,
  extEast,
  hallSouth,
  northBedEast,
  northIn,
  showerNorth,
  showerWest,
  westIn,
} from "./walls.js";

const extEastIn = face(extEast, "west");

export const rooms: Room[] = [
  // The long hallway: a simple L — in from the entrance, a right turn, then straight down to the
  // shower door. Its east edge is the central partition's west face; its west edge is the north
  // bedroom's east wall line, carried straight down past the divide.
  {
    id: "room-hallway-basement",
    name: "Hallway",
    outline: [
      pt(westIn, northIn),
      pt(face(central, "west"), northIn),
      pt(face(central, "west"), face(showerNorth, "north")),
      pt(face(northBedEast, "east"), face(showerNorth, "north")),
      pt(face(northBedEast, "east"), face(hallSouth, "north")),
      pt(westIn, face(hallSouth, "north")),
    ],
  },
  rectRoom("room-guest-north-basement", "Guest Bedroom 1", { west: westIn, east: face(northBedEast, "west"), south: face(bedroomDivide, "north"), north: face(hallSouth, "south") }),
  // Bedroom 2 is L-shaped: its west leg runs beside the shower room, and its north-east leg reaches
  // the corridor's west edge wall so the door opens flush with the corridor.
  {
    id: "room-guest-south-basement",
    name: "Guest Bedroom 2",
    outline: [
      pt(westIn, face(breastSouth, "north")),
      pt(face(showerWest, "west"), face(breastSouth, "north")),
      pt(face(showerWest, "west"), face(showerNorth, "north")),
      pt(face(northBedEast, "west"), face(showerNorth, "north")),
      pt(face(northBedEast, "west"), face(bedroomDivide, "south")),
      pt(westIn, face(bedroomDivide, "south")),
    ],
  },
  rectRoom("room-shower-basement", "Shower Room", { west: face(showerWest, "east"), east: face(central, "west"), south: face(breastSouth, "north"), north: face(showerNorth, "south") }),
  rectRoom("room-garden-basement", "Garden Room", { west: face(central, "east"), east: eastIn, south: face(breastSouth, "north"), north: northIn }),
  // The extension: the stair flight and the reduced-height back door. The flight is a later pass.
  rectRoom("room-rear-hall-basement", "Rear hall", { west: coreW, east: extEastIn, south: extSouthY, north: northIn }),
];
