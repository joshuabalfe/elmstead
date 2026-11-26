/**
 * Elmstead first floor, traced from the owner's first-floor plan (drawing scale about 7.9 mm per px,
 * rounded to 25 mm). External walls stack on the ground floor's; the kitchen/dining wall and the
 * dining/bedroom partition keep the ground floor's measured positions.
 *
 *   +------------------+-----------+-----------+
 *   |     Kitchen      |  Landing  |  stairs   |
 *   |                  |           |  (void)   |
 *   +------------------+           +-----------+
 *   |                  |           |   half    |
 *   |   Dining room    |           |  landing  |
 *   |  (bay to west)   +-----------+  (void)   |
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
import { bayFrontNorthY, bayFrontSouthY, bayNorthY, bayOutX, baySouthY, stairArrivalX, stairEastX, stairNorthY, stairSouthY, stairWestX, walls } from "./walls.js";

/** The hole in the first floor: the stair well and the half landing in the extension. */
export const stairwellOutline: Polygon = [
  pt(stairArrivalX, stairSouthY),
  pt(stairEastX, stairSouthY),
  pt(stairEastX, stairNorthY),
  pt(stairArrivalX, stairNorthY),
];

function slabPiece(id: string, name: string, outline: Polygon) {
  return { id, name, outline, thickness: firstFloorStructure, elevationOffset: mm(0) };
}

const slabs = [
  slabPiece("slab-first-west", "First floor west", [
    pt(mm(0), mm(0)),
    pt(stairWestX, mm(0)),
    pt(stairWestX, stairSouthY),
    pt(stairArrivalX, stairSouthY),
    pt(stairArrivalX, stairNorthY),
    pt(stairWestX, stairNorthY),
    pt(stairWestX, coreD),
    pt(mm(0), coreD),
    pt(mm(0), bayNorthY),
    pt(bayOutX, bayFrontNorthY),
    pt(bayOutX, bayFrontSouthY),
    pt(mm(0), baySouthY),
  ]),
  slabPiece("slab-first-south", "First floor south", [
    pt(stairWestX, mm(0)),
    pt(coreW, mm(0)),
    pt(coreW, stairSouthY),
    pt(stairWestX, stairSouthY),
  ]),
  // Where the stair well runs up to the core's north wall, the cut removes the slab band that
  // normally joins the ground wall top to this floor's wall base, leaving a 200 mm slot between the
  // storeys. Carry the slab over the wall's thickness to close it; the well stays open inside its
  // face. The extension's walls run past this floor unbroken (../extension.ts), so they need none.
  slabPiece("slab-first-north-band", "First floor north band", [
    pt(stairArrivalX, stairNorthY),
    pt(coreW, stairNorthY),
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