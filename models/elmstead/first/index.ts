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
 * The slab is five rectangles around the stairwell, because a slab outline is a simple polygon and
 * the stairwell is a hole in the middle of the floor.
 */
import { mm, pt, sub, type Mm, type Storey, type Wall } from "../../../src/model/index.js";
import { coreD, coreW, extEastX, extSouthY, firstFloor, firstFloorStructure, northT } from "../shared.js";
import { ground } from "../ground/index.js";
import { spineEastX } from "../ground/walls.js";

/** The ground floor's walls, re-id'd and re-heighted; the stair spine divides flights, not rooms. */
const walls: Wall[] = ground.walls
  .filter((w) => w.id !== "wall-stair-spine")
  .map((w) => ({ ...w, id: `${w.id}-first`, height: firstFloor.ceilingHeight }));

// ── Stairwell, from the ground plan ─────────────────────────────────────────
// Both flights run east–west around the spine wall, the lower south of it and the upper north of
// it, turning at the east end. The opening follows the walls and rooms around it: the hallway's
// east edge, the bathroom's north wall, the north wall and the rear hall's west edge.
const stairWest = mm(5690); // lobby/bathroom room edge; 15 mm east of the hallway's edge
const stairEast = spineEastX; // rear hall's west edge at the spine's end
const stairSouth = mm(6080); // bathroom north wall's north face; lower flight 910 mm wide
const stairNorth = sub(coreD, northT); // north wall's inner face; upper flight 910 mm wide

/** The hole in the first floor: both flights and the turn at their east end. */
const stairwell = [pt(stairWest, stairNorth), pt(stairEast, stairNorth), pt(stairEast, stairSouth), pt(stairWest, stairSouth)];

/**
 * One rectangular piece of the first floor, top at the storey's elevation. Its thickness is the
 * floor structure between the ground ceiling and this floor.
 */
function slabPiece(id: string, west: Mm, south: Mm, east: Mm, north: Mm) {
  return { id, name: `First floor ${id.replace("slab-first-", "")}`, outline: [pt(west, south), pt(east, south), pt(east, north), pt(west, north)], thickness: firstFloorStructure, elevationOffset: mm(0) };
}

const slabs = [
  slabPiece("slab-first-west", mm(0), mm(0), stairWest, coreD),
  slabPiece("slab-first-south", stairWest, mm(0), coreW, stairSouth),
  slabPiece("slab-first-north", stairWest, stairNorth, coreW, coreD),
  slabPiece("slab-first-rear", stairEast, stairSouth, coreW, stairNorth),
  slabPiece("slab-first-east", coreW, extSouthY, extEastX, coreD),
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
