/** First-floor rooms, outlined along the faces of the walls around them (./walls.ts). */
import { pt, type Room } from "../../../src/model/index.js";
import { extSouthY } from "../shared.js";
import { partitionEast, partitionX } from "../ground/walls.js";
import {
  bedroomBreastWestX,
  bedroomNorthFaceY,
  bedroomNorthY,
  breastNorthY,
  diningNorthY,
  eastIn,
  ensuiteSouthFaceY,
  ensuiteSouthY,
  ensuiteWestFaceX,
  ensuiteWestX,
  kitchenEastFaceX,
  kitchenEastLowerX,
  kitchenEastX,
  kitchenSouthY,
  kitchenStepY,
  northIn,
  passageWestX,
  southIn,
  stairArrivalNorthY,
  stairArrivalSouthY,
  stairArrivalX,
  stairWestX,
  stepSouthY,
  westIn,
} from "./walls.js";

export const kitchen: Room = {
  id: "room-kitchen-first",
  name: "Kitchen",
  // L-shaped: the east wall steps out above the dining-room wall, leaving a passage to the landing.
  outline: [
    pt(westIn, kitchenSouthY),
    pt(kitchenEastLowerX, kitchenSouthY),
    pt(kitchenEastLowerX, kitchenStepY),
    pt(kitchenEastX, kitchenStepY),
    pt(kitchenEastX, northIn),
    pt(westIn, northIn),
  ],
};

export const dining: Room = {
  id: "room-dining-first",
  name: "Dining room",
  // From the kitchen wall to the chimney breast, and from the thick west wall to the partition: the
  // alcoves beside the breast are built-ins, as in the living room below, and the bay window projects
  // beyond the west wall without adding to the room's dimensions.
  outline: [pt(westIn, breastNorthY), pt(partitionX, breastNorthY), pt(partitionX, diningNorthY), pt(westIn, diningNorthY)],
};

export const landing: Room = {
  id: "room-landing-first",
  name: "Landing",
  // Wraps the west and south of the stair well, with the passage to the dining-room door.
  outline: [
    pt(kitchenEastFaceX, northIn),
    pt(kitchenEastFaceX, stepSouthY),
    pt(passageWestX, stepSouthY),
    pt(passageWestX, kitchenSouthY),
    pt(partitionEast, kitchenSouthY),
    pt(partitionEast, bedroomNorthFaceY),
    pt(stairWestX, bedroomNorthFaceY),
    pt(stairWestX, stairArrivalSouthY),
    pt(stairArrivalX, stairArrivalSouthY),
    pt(stairArrivalX, stairArrivalNorthY),
    pt(stairWestX, stairArrivalNorthY),
    pt(stairWestX, northIn),
  ],
};

export const ensuite: Room = {
  id: "room-ensuite-first",
  name: "Ensuite",
  outline: [pt(ensuiteWestFaceX, ensuiteSouthFaceY), pt(eastIn, ensuiteSouthFaceY), pt(eastIn, extSouthY), pt(ensuiteWestFaceX, extSouthY)],
};

export const bedroom: Room = {
  id: "room-bedroom-first",
  name: "Bedroom",
  // Wraps the ensuite's south and west sides; chimney breast in its south-east corner.
  outline: [
    pt(partitionEast, southIn),
    pt(bedroomBreastWestX, southIn),
    pt(bedroomBreastWestX, breastNorthY),
    pt(eastIn, breastNorthY),
    pt(eastIn, ensuiteSouthY),
    pt(ensuiteWestX, ensuiteSouthY),
    pt(ensuiteWestX, bedroomNorthY),
    pt(partitionEast, bedroomNorthY),
  ],
};

export const rooms: Room[] = [kitchen, dining, landing, ensuite, bedroom];