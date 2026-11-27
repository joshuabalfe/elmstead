/**
 * A two-storey model whose stair starts with a winder, to exercise winders end to end: schema,
 * checks, IFC, round-trip, plan rendering and the viewer.
 *
 *   +--------------------------------------+   north
 *   |                                      |
 *   |  first floor              +----------+
 *   |                           | winder   |   three treads fanning out from the south-west
 *   |                           | (pivot •)|   corner of the block, turning to the right
 *   |                           +----------+
 *   |                           | flight   |   eight risers, climbing south
 *   |                           +----------+
 *   |  first-floor slab is U-shaped, so the stairwell is open with no slab opening
 *   +--------------------------------------+   south
 *
 * 11 risers in all (3 winder + 8 flight) over 2750 mm: exactly 250 mm each, so the levels in the
 * tests are round numbers. Both storeys share one wall layout, as in the two-storey fixture.
 */
import {
  defineBuilding,
  m,
  mm,
  pt,
  rectRoom,
  rectWalls,
  stair,
  stairFlight,
  stairWinder,
  sub,
  type Storey,
} from "../../../src/backend/model/index.js";

const outerW = m(4.2);
const outerD = m(5.4);
const extT = mm(200);
const rise = m(2.75);

const inner = { west: extT, south: extT, east: sub(outerW, extT), north: sub(outerD, extT) };

const shell = (prefix: string, height: typeof rise) =>
  Object.values(rectWalls(prefix, pt(mm(0), mm(0)), outerW, outerD, { thickness: extT, height }));

// ── Stair ────────────────────────────────────────────────────────────────────
// A 900 mm square winder against the east wall, then a flight climbing south from its south edge.
const west = mm(3100);
const east = inner.east;
const south = mm(3900);
const north = mm(4800);
const flightEnd = mm(2150); // 1750 mm of run for 8 risers: 250 mm goings

const southWest = pt(west, south);
const northWest = pt(west, north);

const winder = stairWinder("stair-winder-turn", [southWest, pt(east, south), pt(east, north), northWest], {
  pivot: southWest,
  entry: northWest,
  risers: 3,
});
const flight = stairFlight("stair-flight-main", pt(mm(3550), south), pt(mm(3550), flightEnd), {
  width: mm(900),
  risers: 8,
});

const firstFloor: Storey = {
  id: "storey-first",
  name: "First floor",
  elevation: rise,
  walls: shell("wall-first", m(2.6)),
  openings: [],
  slabs: [
    {
      id: "slab-first",
      name: "First floor slab",
      outline: [
        pt(inner.west, inner.south),
        pt(inner.east, inner.south),
        pt(inner.east, flightEnd),
        pt(west, flightEnd),
        pt(west, north),
        pt(inner.east, north),
        pt(inner.east, inner.north),
        pt(inner.west, inner.north),
      ],
      thickness: mm(200),
      elevationOffset: mm(0),
    },
  ],
  rooms: [
    rectRoom("room-first", "First floor", {
      west: inner.west,
      east: west,
      south: inner.south,
      north: inner.north,
    }),
  ],
};

const ground: Storey = {
  id: "storey-ground",
  name: "Ground floor",
  elevation: mm(0),
  walls: shell("wall", rise),
  openings: [],
  slabs: [
    {
      id: "slab-ground",
      name: "Ground floor slab",
      outline: [pt(mm(0), mm(0)), pt(outerW, mm(0)), pt(outerW, outerD), pt(mm(0), outerD)],
      thickness: mm(150),
      elevationOffset: mm(0),
    },
  ],
  rooms: [rectRoom("room-hall", "Hall", inner)],
  stairs: [stair("stair-main", firstFloor, [winder, flight])],
};

export default defineBuilding({
  project: { id: "project-example-winder", name: "Example winder stair" },
  site: { id: "site-example", name: "Example site" },
  building: { id: "building-example", name: "Example winder stair" },
  storeys: [ground, firstFloor],
});
