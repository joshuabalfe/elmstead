/** First-floor rooms, outlined along the faces of the walls around them (./walls.ts). */
import { pt, type Room } from "../../../src/model/index.js";
import { extRightY } from "../shared.js";
import { partitionRear, partitionX } from "../ground/walls.js";
import {
  bedroomBreastFrontX,
  bedroomLeftFaceY,
  bedroomLeftY,
  breastLeftY,
  diningLeftY,
  rearIn,
  ensuiteRightFaceY,
  ensuiteRightY,
  ensuiteFrontFaceX,
  ensuiteFrontX,
  kitchenRearFaceX,
  kitchenRearLowerX,
  kitchenRearX,
  kitchenRightY,
  kitchenStepY,
  partyIn,
  passageFrontX,
  endIn,
  stairArrivalX,
  stairRightY,
  stairFrontX,
  stepRightY,
  frontIn,
} from "./walls.js";

export const kitchen: Room = {
  id: "room-kitchen-first",
  name: "Kitchen",
  // L-shaped: the east wall steps out above the dining-room wall, leaving a passage to the landing.
  outline: [
    pt(frontIn, kitchenRightY),
    pt(kitchenRearLowerX, kitchenRightY),
    pt(kitchenRearLowerX, kitchenStepY),
    pt(kitchenRearX, kitchenStepY),
    pt(kitchenRearX, partyIn),
    pt(frontIn, partyIn),
  ],
};

export const dining: Room = {
  id: "room-dining-first",
  name: "Dining room",
  // From the kitchen wall to the chimney breast, and from the thick west wall to the partition: the
  // alcoves beside the breast are built-ins, as in the living room below, and the bay window projects
  // beyond the west wall without adding to the room's dimensions.
  outline: [pt(frontIn, breastLeftY), pt(partitionX, breastLeftY), pt(partitionX, diningLeftY), pt(frontIn, diningLeftY)],
};

export const landing: Room = {
  id: "room-landing-first",
  name: "Landing",
  // Wraps the west and south of the stair well, with the passage to the dining-room door.
  outline: [
    pt(kitchenRearFaceX, partyIn),
    pt(kitchenRearFaceX, stepRightY),
    pt(passageFrontX, stepRightY),
    pt(passageFrontX, kitchenRightY),
    pt(partitionX, kitchenRightY),
    pt(partitionX, bedroomLeftFaceY),
    pt(stairFrontX, bedroomLeftFaceY),
    pt(stairFrontX, stairRightY),
    pt(stairArrivalX, stairRightY),
    pt(stairArrivalX, partyIn),
  ],
};

export const ensuite: Room = {
  id: "room-ensuite-first",
  name: "Ensuite",
  outline: [pt(ensuiteFrontFaceX, ensuiteRightFaceY), pt(rearIn, ensuiteRightFaceY), pt(rearIn, extRightY), pt(ensuiteFrontFaceX, extRightY)],
};

export const bedroom: Room = {
  id: "room-bedroom-first",
  name: "Bedroom",
  // Wraps the ensuite's south and west sides; chimney breast in its south-east corner.
  outline: [
    pt(partitionRear, endIn),
    pt(bedroomBreastFrontX, endIn),
    pt(bedroomBreastFrontX, breastLeftY),
    pt(rearIn, breastLeftY),
    pt(rearIn, ensuiteRightY),
    pt(ensuiteFrontX, ensuiteRightY),
    pt(ensuiteFrontX, bedroomLeftY),
    pt(partitionRear, bedroomLeftY),
  ],
  // The plan measures the main room; the entrance strip beside the ensuite is not part of it.
  dimensionOutline: [
    pt(partitionRear, endIn),
    pt(bedroomBreastFrontX, endIn),
    pt(bedroomBreastFrontX, breastLeftY),
    pt(rearIn, breastLeftY),
    pt(rearIn, ensuiteRightY),
    pt(partitionRear, ensuiteRightY),
  ],
};

export const rooms: Room[] = [kitchen, dining, landing, ensuite, bedroom];