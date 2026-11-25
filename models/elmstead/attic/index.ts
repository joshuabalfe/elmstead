/**
 * Elmstead attic (top storey), first pass: an empty floor at a provisional level (see ../shared.ts).
 * The slab is a clean rectangle over the core; it does not extend into the rear extension. Rooms,
 * partitions and openings await the owner's attic plan, so this storey is just the envelope and the
 * floor. The stair well through this floor is a later pass.
 */
import { mm, pt, type Storey } from "../../../src/model/index.js";
import { atticFloor, atticFloorStructure, coreD, coreW } from "../shared.js";
import { walls } from "./walls.js";

export const attic: Storey = {
  id: "storey-attic",
  name: "Attic",
  elevation: atticFloor.elevation,
  walls,
  openings: [],
  slabs: [{ id: "slab-attic", name: "Attic slab", outline: [pt(mm(0), mm(0)), pt(coreW, mm(0)), pt(coreW, coreD), pt(mm(0), coreD)], thickness: atticFloorStructure, elevationOffset: mm(0) }],
  rooms: [],
};
