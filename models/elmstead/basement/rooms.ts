/** Basement rooms, outlined along the faces of the walls around them (./walls.ts). */
import { face, pt, rectRoom, type Room } from "../../../src/model/index.js";
import { coreW, extRightY } from "../shared.js";
import {
  bedroomDivide,
  breastRight,
  central,
  rearIn,
  extRear,
  hallRight,
  leftBedRear,
  partyIn,
  showerLeft,
  showerFront,
  frontIn,
} from "./walls.js";

const extRearIn = face(extRear, "west");

export const rooms: Room[] = [
  // The long hallway: a simple L — in from the entrance, a right turn, then straight down to the
  // shower door. Its east edge is the central partition's west face; its west edge is the north
  // bedroom's east wall line, carried straight down past the divide.
  {
    id: "room-hallway-basement",
    name: "Hallway",
    outline: [
      pt(frontIn, partyIn),
      pt(face(central, "west"), partyIn),
      pt(face(central, "west"), face(showerLeft, "north")),
      pt(face(leftBedRear, "east"), face(showerLeft, "north")),
      pt(face(leftBedRear, "east"), face(hallRight, "north")),
      pt(frontIn, face(hallRight, "north")),
    ],
  },
  rectRoom("room-guest-left-basement", "Guest Bedroom 1", { west: frontIn, east: face(leftBedRear, "west"), south: face(bedroomDivide, "north"), north: face(hallRight, "south") }),
  // Bedroom 2 is L-shaped: its west leg runs beside the shower room, and its north-east leg reaches
  // the corridor's west edge wall so the door opens flush with the corridor.
  {
    id: "room-guest-right-basement",
    name: "Guest Bedroom 2",
    outline: [
      pt(frontIn, face(breastRight, "north")),
      pt(face(showerFront, "west"), face(breastRight, "north")),
      pt(face(showerFront, "west"), face(showerLeft, "north")),
      pt(face(leftBedRear, "west"), face(showerLeft, "north")),
      pt(face(leftBedRear, "west"), face(bedroomDivide, "south")),
      pt(frontIn, face(bedroomDivide, "south")),
    ],
  },
  rectRoom("room-shower-basement", "Shower Room", { west: face(showerFront, "east"), east: face(central, "west"), south: face(breastRight, "north"), north: face(showerLeft, "south") }),
  rectRoom("room-garden-basement", "Garden Room", { west: face(central, "east"), east: rearIn, south: face(breastRight, "north"), north: partyIn }),
  // The extension: the stair flight and the reduced-height back door. The flight is a later pass.
  rectRoom("room-rear-hall-basement", "Rear hall", { west: coreW, east: extRearIn, south: extRightY, north: partyIn }),
];
