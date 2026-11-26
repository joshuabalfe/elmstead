/**
 * A two-storey model with a half-turn stair, to exercise stairs end to end: schema, checks, IFC,
 * round-trip, plan rendering and the plan-versus-3D comparison.
 *
 *   +--------------------------------------+   north
 *   |                                      |
 *   |  first floor     stairwell void      |
 *   |  +---------+-------------------------+
 *   |  |         |  landing                |   the first-floor slab is U-shaped, so the
 *   |  |         +-------------------------+   stairwell is open with no slab opening
 *   |  |         |  upper flight (west)    |
 *   |  |         |  lower flight (east)    |
 *   |  +---------+-------------------------+
 *   |                                      |
 *   +--------------------------------------+   south
 *
 * Both storeys share one wall layout, so the viewer's top view shows the same charcoal wall tops as
 * the ground-floor plan and the plan-versus-3D comparison still lines up.
 */
import { defineBuilding, m, mm, pt, rectRoom, rectWalls, stair, stairFlight, stairLanding, sub, type Storey } from "../../../src/model/index.js";

const outerW = m(6);
const outerD = m(4);
const extT = mm(200);
const rise = m(3.05); // 3050 mm over 16 risers: 190.625 mm each

const inner = { west: extT, south: extT, east: sub(outerW, extT), north: sub(outerD, extT) };
/** The stairwell the first-floor slab leaves open, a little wider than the stair itself. */
const void_ = { west: mm(2600), south: mm(900), east: inner.east, north: mm(2700) };

/** Both storeys: the same four external walls, so their tops coincide in the viewer's top view. */
const shell = (prefix: string, height: typeof rise) => Object.values(rectWalls(prefix, pt(mm(0), mm(0)), outerW, outerD, { thickness: extT, height }));

// ── Stair ────────────────────────────────────────────────────────────────────
// Two flights of 8 risers, 800 wide, either side of a 180° turn at the east end.
const flightWest = mm(2600); // where both flights leave and arrive along x
const flightEast = mm(4400);
const lowerY = mm(1400); // centreline of the lower flight, which climbs east
const upperY = mm(2200); // centreline of the upper flight, which climbs west
const stairWidth = mm(800);

const lowerFlight = stairFlight("stair-flight-lower", pt(flightWest, lowerY), pt(flightEast, lowerY), { width: stairWidth, risers: 8 });
const upperFlight = stairFlight("stair-flight-upper", pt(flightEast, upperY), pt(flightWest, upperY), { width: stairWidth, risers: 8 });
// Its west edge carries both flights' ends, so each meets the landing's boundary exactly.
const halfLanding = stairLanding(
  "stair-landing-half",
  [pt(flightEast, mm(1000)), pt(mm(5200), mm(1000)), pt(mm(5200), mm(2600)), pt(flightEast, mm(2600))],
  { thickness: mm(150) },
);

const firstFloor: Storey = {
  id: "storey-first",
  name: "First floor",
  elevation: rise,
  walls: shell("wall-first", m(2.8)),
  openings: [],
  slabs: [
    {
      id: "slab-first",
      name: "First floor slab",
      outline: [
        pt(inner.west, inner.south),
        pt(inner.east, inner.south),
        pt(inner.east, void_.south),
        pt(void_.west, void_.south),
        pt(void_.west, void_.north),
        pt(inner.east, void_.north),
        pt(inner.east, inner.north),
        pt(inner.west, inner.north),
      ],
      thickness: mm(200),
      elevationOffset: mm(0),
    },
  ],
  rooms: [rectRoom("room-first", "First floor", { west: inner.west, east: void_.west, south: inner.south, north: inner.north })],
};

const ground: Storey = {
  id: "storey-ground",
  name: "Ground floor",
  elevation: mm(0),
  walls: shell("wall", rise),
  openings: [],
  slabs: [{ id: "slab-ground", name: "Ground floor slab", outline: [pt(mm(0), mm(0)), pt(outerW, mm(0)), pt(outerW, outerD), pt(mm(0), outerD)], thickness: mm(150), elevationOffset: mm(0) }],
  rooms: [rectRoom("room-hall", "Hall", inner)],
  stairs: [stair("stair-main", firstFloor, [lowerFlight, halfLanding, upperFlight])],
};

export default defineBuilding({
  project: { id: "project-example-two-storey", name: "Example two-storey" },
  site: { id: "site-example", name: "Example site" },
  building: { id: "building-example", name: "Example two-storey" },
  storeys: [ground, firstFloor],
});
