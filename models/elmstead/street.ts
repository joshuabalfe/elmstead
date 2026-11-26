/**
 * External works at the front of the house: the street level, its ground slab, the four front steps
 * to the front door, and the handrails down each side of them and along the front at the bottom.
 * The door is on the front wall, 150 mm from its left end (owner), so the steps climb towards the
 * rear out of the street to the threshold.
 *
 * The ground sits 900 mm clear of the front wall (owner), so the flight's 900 mm run lands its
 * bottom step on the ground edge. At the right end of the front rail it wraps the front-right
 * corner and continues along the end wall to the core's rear-right corner, at the same 2.4 m
 * depth. The front rail stops 900 mm short of the corner; a short return from the house corner
 * closes the end of the front gap and leaves a 900 mm opening round the corner onto the wrap.
 * Nothing extends under the footprint: a basement goes there.
 *
 * The railings follow the nosing line: base 150 mm at the first tread, 600 mm at the threshold,
 * and start 20 mm up the flight so the bottom post sits wholly on the first tread.
 */
import { add, div, m, mm, pt, railing, scale, stair, stairFlight, sub, type Mm } from "../../src/model/index.js";
import type { Storey } from "../../src/schema/schema.js";
import { frontDoorCentreY } from "./ground/openings.js";
import { ground } from "./ground/index.js";
import { coreD, coreW, frontRailingEdgeInset, frontRailingEndInset, frontRailingHeight, frontStepGoing, frontStepRiser, frontStepRisers, frontStepWidth, streetFloor } from "./shared.js";

const frontApron = m(2.4);
const frontGap = mm(900);
const groundRear = sub(mm(0), frontGap);
const groundFront = sub(groundRear, frontApron);
const groundRight = sub(mm(0), frontApron);
const cornerGap = mm(900);
const stepOut = scale(frontStepGoing, frontStepRisers - 1);
const railY = sub(div(frontStepWidth, 2), frontRailingEdgeInset);
const railBottomX = add(sub(mm(0), stepOut), frontRailingEndInset);
const railTopBase = scale(frontStepRiser, frontStepRisers);

const stepRailing = (id: string, y: Mm) =>
  railing(id, pt(railBottomX, y), pt(mm(0), y), { height: frontRailingHeight, startBase: frontStepRiser, endBase: railTopBase });

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
      outline: [pt(groundFront, groundRight), pt(coreW, groundRight), pt(coreW, mm(0)), pt(groundRear, mm(0)), pt(groundRear, coreD), pt(groundFront, coreD)],
      thickness: mm(50),
      elevationOffset: mm(0),
      material: "ground",
    },
  ],
  rooms: [],
  // Four risers (owner) from the street to the door threshold, running towards the rear to the front wall.
  stairs: [stair("stair-front", ground, [stairFlight("stair-flight-front", pt(sub(mm(0), stepOut), frontDoorCentreY), pt(mm(0), frontDoorCentreY), { width: frontStepWidth, risers: frontStepRisers })])],
  railings: [
    stepRailing("railing-front-left", add(frontDoorCentreY, railY)),
    stepRailing("railing-front-right", sub(frontDoorCentreY, railY)),
    // Continue the right step railing from the bottom of the steps towards the end wall along the
    // front of the house, at street level on the ground slab's edge, stopping 900 mm short of the
    // corner.
    railing("railing-front-facade-right", pt(groundRear, sub(frontDoorCentreY, railY)), pt(groundRear, cornerGap), { height: frontRailingHeight }),
    // A short return out from the house's front-right corner closes the end of the front gap and
    // leaves the 900 mm opening between the two rails for the pavement wrap.
    railing("railing-front-corner", pt(mm(0), mm(0)), pt(groundRear, mm(0)), { height: frontRailingHeight }),
  ],
};
