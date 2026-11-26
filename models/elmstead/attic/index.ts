/**
 * Elmstead attic (top storey), first pass: an empty floor at a provisional level (see ../shared.ts).
 * The slab is a clean rectangle over the core with the stair well cut out of its north-east corner;
 * it does not extend into the rear extension. The well is the first floor's rectangle
 * (../first/walls.ts), clipped to the core: the rear is open at floor level, so the cut runs out to
 * the core's east edge, and the north band stays under the gable. Rooms, partitions and openings
 * await the owner's attic plan. The stair up to this floor is in ../first/stair.ts.
 */
import { mm, pt, type Storey } from "../../../src/model/index.js";
import { atticFloor, atticFloorStructure, coreD, coreW } from "../shared.js";
import { stairArrivalX, stairNorthY, stairSouthY } from "../first/walls.js";
import { walls } from "./walls.js";

export const attic: Storey = {
  id: "storey-attic",
  name: "Attic",
  elevation: atticFloor.elevation,
  walls,
  openings: [],
  slabs: [{
    id: "slab-attic",
    name: "Attic slab",
    outline: [
      pt(mm(0), mm(0)),
      pt(coreW, mm(0)),
      pt(coreW, stairSouthY),
      pt(stairArrivalX, stairSouthY),
      pt(stairArrivalX, stairNorthY),
      pt(coreW, stairNorthY),
      pt(coreW, coreD),
      pt(mm(0), coreD),
    ],
    thickness: atticFloorStructure,
    elevationOffset: mm(0),
  }],
  rooms: [],
};
