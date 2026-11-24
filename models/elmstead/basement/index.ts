/**
 * Elmstead basement, traced from the owner's basement plan (first pass). It sits below the ground
 * floor at a provisional level (see ../shared.ts); the external walls stack on the shared runs.
 *
 *   +----------------------------+--------+   north
 *   |  Hallway        |          | rear   |
 *   +--------------+  |  Garden  | hall   |
 *   | Guest (north)|  |  Room    |(stair) |
 *   +--------------+  |          +--------+
 *   | Guest (south)|Sh|          |
 *   +--------------+--+----------+   south
 *
 * The stair flight in the extension and the well it climbs through are a later pass, so the basement
 * slab is solid here. The west-wall piers and the shower-room south thickening await the eye check.
 */
import { mm, type Storey } from "../../../src/model/index.js";
import { basementFloor, footprint } from "../shared.js";
import { openings } from "./openings.js";
import { rooms } from "./rooms.js";
import { walls } from "./walls.js";

export const basement: Storey = {
  id: "storey-basement",
  name: "Basement",
  elevation: basementFloor.elevation,
  walls,
  openings,
  slabs: [{ id: "slab-basement", name: "Basement slab", outline: footprint, thickness: mm(150), elevationOffset: mm(0) }],
  rooms,
};
