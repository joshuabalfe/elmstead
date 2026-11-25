/**
 * Elmstead attic (top storey), first pass: an empty floor at a provisional level (see ../shared.ts).
 * The external walls stack on the first floor's; the slab covers the footprint with the stair well
 * left open, ready for the stair to climb through. Rooms, partitions and openings await the owner's
 * attic plan, so this storey is just the envelope and the floor.
 *
 * The well is the first floor's rectangle (../first/walls.ts). A slab outline is a simple polygon, so
 * the floor is tiled as five rectangles around it: the core south of the extension, the strip west of
 * the well, and north/south/east bands closing the well's edges up to the external walls.
 */
import { mm, pt, type Polygon, type Storey } from "../../../src/model/index.js";
import { atticFloor, atticFloorStructure, coreD, coreW, extEastX, extSouthY } from "../shared.js";
import { stairArrivalX, stairEastX, stairNorthY, stairSouthY } from "../first/walls.js";
import { walls } from "./walls.js";

function slabPiece(id: string, name: string, outline: Polygon) {
  return { id, name, outline, thickness: atticFloorStructure, elevationOffset: mm(0) };
}

const slabs = [
  slabPiece("slab-attic-south", "Attic south", [pt(mm(0), mm(0)), pt(coreW, mm(0)), pt(coreW, extSouthY), pt(mm(0), extSouthY)]),
  slabPiece("slab-attic-west", "Attic west", [pt(mm(0), extSouthY), pt(stairArrivalX, extSouthY), pt(stairArrivalX, coreD), pt(mm(0), coreD)]),
  slabPiece("slab-attic-north-band", "Attic north band", [pt(stairArrivalX, stairNorthY), pt(extEastX, stairNorthY), pt(extEastX, coreD), pt(stairArrivalX, coreD)]),
  slabPiece("slab-attic-south-band", "Attic south band", [pt(stairArrivalX, extSouthY), pt(extEastX, extSouthY), pt(extEastX, stairSouthY), pt(stairArrivalX, stairSouthY)]),
  slabPiece("slab-attic-east-band", "Attic east band", [pt(stairEastX, stairSouthY), pt(extEastX, stairSouthY), pt(extEastX, stairNorthY), pt(stairEastX, stairNorthY)]),
];

export const attic: Storey = {
  id: "storey-attic",
  name: "Attic",
  elevation: atticFloor.elevation,
  walls,
  openings: [],
  slabs,
  rooms: [],
};
