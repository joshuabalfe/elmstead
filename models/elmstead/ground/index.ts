/**
 * Elmstead ground floor, traced from the owner's ground-floor plan image (first pass).
 *
 *   +----------------------------+--------+   party wall
 *   |  Hallway        | stairs   | rear   |
 *   |                 | (flight) | hall   |
 *   +--------------+ \ +----------+--------+
 *   |              | Lobby| Bathroom |
 *   |  Living room |  +---+----------+
 *   |              |  |   Bedroom   |
 *   +--------------+--+-------------+   end wall
 *   front door in the front wall
 *
 *   walls.ts      walls, and the plan positions everything else derives from
 *   openings.ts   doors and windows: component, wall, position, swing
 *   rooms.ts      room outlines along the wall faces
 *   stair.ts      the provisional half-turn stair to the first floor, and its half-landing storey
 *
 * Left out for now: hearths, radiators and rainwater pipes. The alcoves beside the
 * living-room chimney breast are built-ins, so they are not part of the room.
 */
import { mm, type Storey } from "../../../src/backend/model/index.js";
import { footprint, groundFloor, groundSlabT } from "../shared.js";
import { openings } from "./openings.js";
import { rooms } from "./rooms.js";
import { stairs } from "./stair.js";
import { walls } from "./walls.js";

export const ground: Storey = {
  id: "storey-ground",
  name: "Ground floor",
  elevation: groundFloor.elevation,
  walls,
  openings,
  slabs: [
    {
      id: "slab-ground",
      name: "Ground floor slab",
      outline: footprint,
      thickness: groundSlabT,
      elevationOffset: mm(0),
    },
  ],
  rooms,
  stairs,
};
