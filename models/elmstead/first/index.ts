/**
 * Elmstead first floor, traced from the owner's first-floor plan (drawing scale about 7.9 mm per
 * px, rounded to 25 mm). External walls stack on the ground floor's; the kitchen/dining wall and
 * the dining/bedroom partition keep the ground floor's measured positions.
 *
 *   +------------------+-----------+-----------+
 *   |     Kitchen      |  Landing  |  stairs   |
 *   |                  |           |  (void)   |
 *   +------------------+           +-----------+
 *   |                  |           |   half    |
 *   |   Dining room    |           |  landing  |
 *   |  (front bay)     +-----------+  (void)   |
 *   |                  |  Ensuite  |           |
 *   +------------------+-----------+-----------+
 *   |                  |        Bedroom        |
 *   +------------------+-----------------------+
 *
 * stair.ts holds the provisional half-turn stair up to the attic, over the stair well, and its
 * half-landing storey.
 *
 * The slab is two rectangles around the stair well and the half landing, because a slab outline is
 * a simple polygon and the stair well is a hole in the middle of the floor. The half landing's
 * window is on the main half landing's storey (../ground/stair.ts), not this one.
 */
import { mm, pt, type Polygon, type Storey } from "../../../src/model/index.js";
import { coreD, coreW, firstFloor, firstFloorStructure } from "../shared.js";
import { openings } from "./openings.js";
import { rooms } from "./rooms.js";
import { stairs } from "./stair.js";
import {
  bayFrontLeftY,
  bayFrontRightY,
  bayLeftY,
  bayOutX,
  bayRightY,
  stairArrivalX,
  stairRearX,
  stairLeftY,
  stairRightY,
  stairFrontX,
  walls,
} from "./walls.js";

/** The hole in the first floor: the stair well and the half landing in the extension. */
export const stairwellOutline: Polygon = [
  pt(stairArrivalX, stairRightY),
  pt(stairRearX, stairRightY),
  pt(stairRearX, stairLeftY),
  pt(stairArrivalX, stairLeftY),
];

function slabPiece(id: string, name: string, outline: Polygon) {
  return { id, name, outline, thickness: firstFloorStructure, elevationOffset: mm(0) };
}

const slabs = [
  slabPiece("slab-first-front", "First floor front", [
    pt(mm(0), mm(0)),
    pt(stairFrontX, mm(0)),
    pt(stairFrontX, stairRightY),
    pt(stairArrivalX, stairRightY),
    pt(stairArrivalX, stairLeftY),
    pt(stairFrontX, stairLeftY),
    pt(stairFrontX, coreD),
    pt(mm(0), coreD),
    pt(mm(0), bayLeftY),
    pt(bayOutX, bayFrontLeftY),
    pt(bayOutX, bayFrontRightY),
    pt(mm(0), bayRightY),
  ]),
  slabPiece("slab-first-right", "First floor right", [
    pt(stairFrontX, mm(0)),
    pt(coreW, mm(0)),
    pt(coreW, stairRightY),
    pt(stairFrontX, stairRightY),
  ]),
  // Where the stair well runs up to the core's party wall, the cut removes the slab band that
  // normally joins the ground wall top to this floor's wall base, leaving a 200 mm slot between the
  // storeys. Carry the slab over the wall's thickness to close it; the well stays open inside its
  // face. The extension's walls run past this floor unbroken (../extension.ts), so they need none.
  slabPiece("slab-first-left-band", "First floor left band", [
    pt(stairArrivalX, stairLeftY),
    pt(coreW, stairLeftY),
    pt(coreW, coreD),
    pt(stairArrivalX, coreD),
  ]),
];

export const first: Storey = {
  id: "storey-first-floor",
  name: "First floor",
  elevation: firstFloor.elevation,
  walls,
  openings,
  slabs,
  rooms,
  stairs,
};
