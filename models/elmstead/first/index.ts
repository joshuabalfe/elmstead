/**
 * Elmstead first floor, provisional: the ground floor's wall and room layout re-id'd, no openings
 * yet, and the stairwell cut out of the slab over the stair the ground floor reserves. Nothing here
 * is measured; it exists so a two-storey Elmstead can be looked at. Trace it properly when the
 * owner's first-floor plan arrives.
 *
 *   +----------------------------+--------+   north
 *   |  Hallway        | stairs   | rear   |
 *   |                 |  (void)  | hall   |
 *   +--------------+ \ +----------+--------+
 *   |              | Lobby| Bathroom |
 *   |  Living room |  +---+----------+
 *   |              |  |   Bedroom   |
 *   +--------------+--+-------------+   south
 *
 * The slab is seven rectangles around the stairwell, because a slab outline is a simple polygon and
 * the stairwell is a hole in the middle of the floor.
 */
import { add, divRound, mm, pt, sub, type Mm, type Storey, type Wall } from "../../../src/model/index.js";
import { brickT, coreD, coreW, eastT, extEastX, extSouthY, firstFloor, firstFloorStructure, northT, southT, westT } from "../shared.js";
import { ground } from "../ground/index.js";

/** The ground floor's walls, re-id'd and re-heighted; the stair spine divides flights, not rooms. */
const walls: Wall[] = ground.walls
  .filter((w) => w.id !== "wall-stair-spine")
  .map((w) => ({ ...w, id: `${w.id}-first`, height: firstFloor.ceilingHeight }));

// ── Stairwell, from the ground floor's traced positions ─────────────────────
const stairWest = mm(5050); // where the stair footprint starts, north of the spine
const lobbyEast = mm(5205); // the lobby's east face, the lower flight's west edge
const spineSouth = mm(6025); // the spine wall's faces
const spineNorth = mm(6200);
const spineEast = mm(7920); // where the spine stops and the flights turn
const rearHallEast = mm(8975); // east face of the rear hall, where it meets the extension
const voidEast = mm(9225); // east edge of the stairwell turn
const voidSouth = mm(5175); // south edge of the stairwell void
const voidNorth = mm(7050); // north edge of the stairwell void

/** The hole in the first floor: both flights and the turn at their east end. */
const stairwell = [
  pt(stairWest, voidNorth),
  pt(spineEast, voidNorth),
  pt(spineEast, spineNorth),
  pt(rearHallEast, spineNorth),
  pt(rearHallEast, voidNorth),
  pt(voidEast, voidNorth),
  pt(voidEast, voidSouth),
  pt(lobbyEast, voidSouth),
  pt(lobbyEast, spineSouth),
  pt(stairWest, spineSouth),
];

// The slab reaches half a wall into the external walls, so its edges are buried and never cross
// the facade. Edges exposed inside — around the stairwell — show the floor structure's thickness.
const westBuried = divRound(westT, 2);
const southBuried = divRound(southT, 2);
const northBuried = sub(coreD, divRound(northT, 2));
const coreEastBuried = sub(coreW, divRound(eastT, 2));
const extEastBuried = sub(extEastX, divRound(brickT, 2));
const extSouthBuried = add(extSouthY, divRound(brickT, 2));

/**
 * One rectangular piece of the first floor, top at the storey's elevation. Its thickness is the
 * floor structure between the ground ceiling and this floor.
 */
function slabPiece(id: string, west: Mm, south: Mm, east: Mm, north: Mm) {
  return { id, name: `First floor ${id.replace("slab-first-", "")}`, outline: [pt(west, south), pt(east, south), pt(east, north), pt(west, north)], thickness: firstFloorStructure, elevationOffset: mm(0) };
}

const slabs = [
  slabPiece("slab-first-west", westBuried, southBuried, stairWest, northBuried),
  slabPiece("slab-first-south", stairWest, southBuried, coreEastBuried, voidSouth),
  slabPiece("slab-first-lobby", stairWest, voidSouth, lobbyEast, spineSouth),
  slabPiece("slab-first-rear-hall", spineEast, spineNorth, rearHallEast, northBuried),
  slabPiece("slab-first-north", stairWest, voidNorth, spineEast, northBuried),
  slabPiece("slab-first-north-east", rearHallEast, voidNorth, voidEast, northBuried),
  slabPiece("slab-first-east", voidEast, extSouthBuried, extEastBuried, northBuried),
];

export const first: Storey = {
  id: "storey-first-floor",
  name: "First floor",
  elevation: firstFloor.elevation,
  walls,
  openings: [],
  slabs,
  rooms: ground.rooms.map((r) => ({ ...r, id: `${r.id}-first` })),
};

/** The stairwell outline, for the stair change to check its flights and landing against. */
export const stairwellOutline = stairwell;
