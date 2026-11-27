/** Ground-floor rooms, outlined along the faces of the walls around them (./walls.ts). */
import { face, faceCrossing, mm, pt, rectRoom, type Room } from "../../../src/model/index.js";
import { coreW } from "../shared.js";
import {
  bathLeftY,
  bedroomBathroom,
  bedroomWallY,
  breastBedroom,
  breastLiving,
  rear,
  rearIn,
  extRear,
  extRight,
  hallLiving,
  hallWallY,
  lobbyBathroom,
  lobbyScreen,
  partyIn,
  partitionRear,
  partitionX,
  spine,
  spineRearX,
  frontIn,
} from "./walls.js";

const hallLeftFace = face(hallLiving, "north");
const spineLeft = face(spine, "north");
const stairFrontX = mm(5675); // where the stair footprint starts left of the spine
const bathFrontFace = face(lobbyBathroom, "east");
const bedBathLeft = face(bedroomBathroom, "north");
const rearHallRearX = mm(10000); // rear face of the rear hall, where it meets the extension

// Starts at the front of the chimney breast: the alcoves either side of it are built-ins, not floor space.
export const living = rectRoom("room-living", "Living room", {
  west: frontIn,
  east: partitionX,
  south: face(breastLiving, "north"),
  north: hallWallY,
});

export const rooms: Room[] = [
  living,
  {
    id: "room-hallway",
    name: "Hallway",
    // Along the lobby screen's hall-side face (its left), from the hall wall to the spine's left corner.
    outline: [
      pt(frontIn, hallLeftFace),
      faceCrossing(lobbyScreen, "left", "y", hallLeftFace),
      faceCrossing(lobbyScreen, "left", "y", spineLeft),
      pt(stairFrontX, spineLeft),
      pt(stairFrontX, partyIn),
      pt(frontIn, partyIn),
    ],
  },
  {
    id: "room-lobby",
    name: "Lobby",
    outline: [
      pt(partitionRear, bedBathLeft),
      pt(face(lobbyBathroom, "west"), bedBathLeft),
      pt(face(lobbyBathroom, "west"), face(spine, "south")),
      // Along the lobby screen's lobby-side face (its right), from the spine to the partition.
      faceCrossing(lobbyScreen, "right", "y", face(spine, "south")),
      faceCrossing(lobbyScreen, "right", "x", partitionRear),
    ],
  },
  {
    id: "room-bedroom",
    name: "Bedroom",
    outline: [
      pt(partitionRear, face(breastBedroom, "north")),
      pt(rearIn, face(breastBedroom, "north")),
      pt(rearIn, bedroomWallY),
      pt(partitionRear, bedroomWallY),
    ],
  },
  {
    id: "room-bathroom",
    name: "Bathroom",
    outline: [
      pt(bathFrontFace, bedBathLeft),
      pt(rearIn, bedBathLeft),
      pt(rearIn, bathLeftY),
      pt(bathFrontFace, bathLeftY),
    ],
  },
  {
    id: "room-rear-hall",
    name: "Rear hall",
    // Steps around the rear wall's head, which sits just left of the extension's right wall face.
    outline: [
      pt(coreW, face(extRight, "north")),
      pt(face(extRear, "west"), face(extRight, "north")),
      pt(face(extRear, "west"), partyIn),
      pt(rearHallRearX, partyIn),
      pt(rearHallRearX, spineLeft),
      pt(spineRearX, spineLeft),
      pt(spineRearX, rear.end.y),
      pt(coreW, rear.end.y),
    ],
  },
];
