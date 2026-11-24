/**
 * A minimal external-storey example: a house with three front steps from the street level to the
 * front door, and the external ground drawn as a ground slab. The walls start at the ground floor,
 * so the example has no basement or plinth closing the face below it.
 */
import { centredOn, defineBuilding, door, m, mm, pt, rectWalls, stair, stairFlight } from "../../src/model/index.js";
import type { Storey } from "../../src/schema/schema.js";

const ext = rectWalls("wall-external", pt(mm(0), mm(0)), m(8), m(6), { thickness: mm(200), height: m(2.7) });

const ground: Storey = {
  id: "storey-ground",
  name: "Ground floor",
  elevation: mm(0),
  walls: [ext.south, ext.east, ext.north, ext.west],
  openings: [door("door-front", ext.south, centredOn(ext.south, mm(4000), mm(1000)), { width: mm(1000), height: mm(2100) })],
  slabs: [
    {
      id: "slab-ground-floor",
      name: "Ground floor slab",
      outline: [pt(mm(0), mm(0)), pt(m(8), mm(0)), pt(m(8), m(6)), pt(mm(0), m(6))],
      thickness: mm(150),
      elevationOffset: mm(0),
    },
  ],
  rooms: [],
};

const street: Storey = {
  id: "storey-street",
  name: "Street level",
  elevation: mm(-450),
  walls: [],
  openings: [],
  slabs: [
    {
      id: "slab-ground-external",
      name: "External ground",
      outline: [pt(mm(-2000), mm(-2000)), pt(mm(10000), mm(-2000)), pt(mm(10000), mm(8000)), pt(mm(-2000), mm(8000))],
      thickness: mm(50),
      elevationOffset: mm(0),
      material: "ground",
    },
  ],
  rooms: [],
  // 450 mm over 3 risers: 150 mm each, a 300 mm going, landing at the front door threshold.
  stairs: [stair("stair-front", ground, [stairFlight("stair-flight-front", pt(mm(4000), mm(-600)), pt(mm(4000), mm(0)), { width: mm(1200), risers: 3 })])],
};

export default defineBuilding({
  project: { id: "project-external-storey", name: "External storey example" },
  site: { id: "site-external-storey", name: "Site" },
  building: { id: "building-external-storey", name: "External storey example" },
  storeys: [street, ground],
});