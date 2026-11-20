/** Ground-floor rooms, outlined along the faces of the walls around them (./walls.ts). */
import { face, faceCrossing, mm, pt, rectRoom, type Room } from "../../../src/model/index.js";
import { coreW } from "../shared.js";
import {
  bathNorthY,
  bedroomBathroom,
  bedroomWallY,
  breastBedroom,
  breastLiving,
  east,
  eastIn,
  extEast,
  extSouth,
  hallLiving,
  hallWallY,
  lobbyBathroom,
  lobbyScreen,
  northIn,
  partitionEast,
  partitionX,
  spine,
  spineEastX,
  westIn,
} from "./walls.js";

const hallNorthFace = face(hallLiving, "north");
const spineNorth = face(spine, "north");
const stairWestX = mm(5675); // where the stair footprint starts north of the spine
const bathWestFace = face(lobbyBathroom, "east");
const bedBathNorth = face(bedroomBathroom, "north");
const rearHallEastX = mm(10000); // east face of the rear hall, where it meets the extension

// Starts at the front of the chimney breast: the alcoves either side of it are built-ins, not floor space.
export const living = rectRoom("room-living", "Living room", { west: westIn, east: partitionX, south: face(breastLiving, "north"), north: hallWallY });

export const rooms: Room[] = [
  living,
  {
    id: "room-hallway",
    name: "Hallway",
    // Along the lobby screen's hall-side face (its left), from the hall wall to the spine's end.
    outline: [
      pt(westIn, hallNorthFace),
      faceCrossing(lobbyScreen, "left", "y", hallNorthFace),
      faceCrossing(lobbyScreen, "left", "x", spine.start.x),
      pt(spine.start.x, spineNorth),
      pt(stairWestX, spineNorth),
      pt(stairWestX, northIn),
      pt(westIn, northIn),
    ],
  },
  {
    id: "room-lobby",
    name: "Lobby",
    outline: [
      pt(partitionEast, bedBathNorth),
      pt(face(lobbyBathroom, "west"), bedBathNorth),
      pt(face(lobbyBathroom, "west"), face(spine, "south")),
      // Along the lobby screen's lobby-side face (its right), from the spine to the partition.
      faceCrossing(lobbyScreen, "right", "y", face(spine, "south")),
      faceCrossing(lobbyScreen, "right", "x", partitionEast),
    ],
  },
  {
    id: "room-bedroom",
    name: "Bedroom",
    outline: [
      pt(partitionEast, face(breastBedroom, "north")),
      pt(eastIn, face(breastBedroom, "north")),
      pt(eastIn, bedroomWallY),
      pt(partitionEast, bedroomWallY),
    ],
  },
  {
    id: "room-bathroom",
    name: "Bathroom",
    outline: [pt(bathWestFace, bedBathNorth), pt(eastIn, bedBathNorth), pt(eastIn, bathNorthY), pt(bathWestFace, bathNorthY)],
  },
  {
    id: "room-rear-hall",
    name: "Rear hall",
    // Steps around the east wall's head, which sits just north of the extension's south wall face.
    outline: [
      pt(coreW, face(extSouth, "north")),
      pt(face(extEast, "west"), face(extSouth, "north")),
      pt(face(extEast, "west"), northIn),
      pt(rearHallEastX, northIn),
      pt(rearHallEastX, spineNorth),
      pt(spineEastX, spineNorth),
      pt(spineEastX, east.end.y),
      pt(coreW, east.end.y),
    ],
  },
];
