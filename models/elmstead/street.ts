/**
 * External works at the front of the house: the street level, its ground slab and the four front
 * steps to the front door. The door is on the west wall, 150 mm from its north end (owner), so the
 * steps climb east out of the street to the threshold.
 *
 * The ground sits 900 mm clear of the front wall (owner), so the flight's 900 mm run lands its
 * bottom step on the ground edge. Nothing extends under the footprint: a basement goes there.
 */
import { div, m, mm, pt, scale, stair, stairFlight, sub } from "../../src/model/index.js";
import type { Storey } from "../../src/schema/schema.js";
import { ground } from "./ground/index.js";
import { frontDoorOffset, frontDoorWidth } from "./ground/openings.js";
import { northIn } from "./ground/walls.js";
import { coreD, frontStepGoing, frontStepRisers, streetFloor } from "./shared.js";

const frontApron = m(2.4);
const frontGap = mm(900);
const groundEast = sub(mm(0), frontGap);
const groundWest = sub(groundEast, frontApron);
const doorCentreY = sub(sub(northIn, frontDoorOffset), div(frontDoorWidth, 2));
const stepOut = scale(frontStepGoing, frontStepRisers - 1);
const stepWidth = mm(2000);

export const street: Storey = {
  id: "storey-street",
  name: "Street level",
  elevation: streetFloor.elevation,
  walls: [],
  openings: [],
  slabs: [
    {
      id: "slab-external-ground",
      name: "External ground",
      outline: [pt(groundWest, mm(0)), pt(groundEast, mm(0)), pt(groundEast, coreD), pt(groundWest, coreD)],
      thickness: mm(50),
      elevationOffset: mm(0),
      material: "ground",
    },
  ],
  rooms: [],
  // Four risers (owner) from the street to the door threshold, running east to the west wall.
  stairs: [stair("stair-front", ground, [stairFlight("stair-flight-front", pt(sub(mm(0), stepOut), doorCentreY), pt(mm(0), doorCentreY), { width: stepWidth, risers: frontStepRisers })])],
};