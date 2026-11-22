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
import { mm, pt, type Mm, type Storey, type Wall } from "../../../src/model/index.js";
import { coreD, extEastX, firstFloor } from "../shared.js";
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
const extEastIn = mm(9225); // inside face of the extension's east wall
const extSouthIn = mm(5175); // inside face of the extension's south wall
const northIn = mm(7050); // inside face of the north wall

/** The hole in the first floor: both flights and the turn at their east end. */
const stairwell = [
  pt(stairWest, northIn),
  pt(spineEast, northIn),
  pt(spineEast, spineNorth),
  pt(rearHallEast, spineNorth),
  pt(rearHallEast, northIn),
  pt(extEastIn, northIn),
  pt(extEastIn, extSouthIn),
  pt(lobbyEast, extSouthIn),
  pt(lobbyEast, spineSouth),
  pt(stairWest, spineSouth),
];

const slabThickness = mm(200);

/** One rectangular piece of the first floor, top at the storey's elevation. */
function slabPiece(id: string, west: Mm, south: Mm, east: Mm, north: Mm) {
  return { id, name: `First floor ${id.replace("slab-first-", "")}`, outline: [pt(west, south), pt(east, south), pt(east, north), pt(west, north)], thickness: slabThickness, elevationOffset: mm(0) };
}

const slabs = [
  slabPiece("slab-first-west", mm(0), mm(0), stairWest, coreD),
  slabPiece("slab-first-south", stairWest, mm(0), extEastX, extSouthIn),
  slabPiece("slab-first-lobby", stairWest, extSouthIn, lobbyEast, spineSouth),
  slabPiece("slab-first-rear-hall", spineEast, spineNorth, rearHallEast, coreD),
  slabPiece("slab-first-north", stairWest, northIn, spineEast, coreD),
  slabPiece("slab-first-north-east", rearHallEast, northIn, extEastIn, coreD),
  slabPiece("slab-first-east", extEastIn, extSouthIn, extEastX, coreD),
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
