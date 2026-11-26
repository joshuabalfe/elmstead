/**
 * Elmstead's provisional half-turn stair, first floor to attic, stacked over the main stair inside
 * the attic's stair well (../attic/index.ts). Owner: 8 + 8 risers and a smaller half landing than
 * the main stair's. Over the provisional 2900 mm rise that is a 181.25 mm riser. You step on from
 * the first-floor landing, where the main stair arrives: the lower flight climbs east above the main
 * stair's lower flight, turns on a half landing at the core's east edge, and the upper flight climbs
 * west back to the attic's well edge. The goings are assumed at 280 mm, the main stair's upper
 * going, which leaves the half landing about 1 m deep; update them when the owner measures them.
 *
 * The half landing is a storey of its own (../shared.ts), so the stair is two, as the main stair is
 * (../ground/stair.ts), and the wall at the back of the landing stands on it.
 */
import { face, mid, mm, pt, stairFlight, sub, wall, type Stair, type Storey } from "../../../src/model/index.js";
import { atticHalfLandingWalls } from "../extension.js";
import { atticFloor, atticHalfLanding, atticStairRisers, coreW, studT } from "../shared.js";
import { bathNorth, northIn, spine, spineEndX, spineY } from "../ground/walls.js";
import { stairArrivalX, stairEastX, stairNorthY, stairSouthY } from "./walls.js";

// The flights keep the main stair's centrelines and width, so each sits over the flight below it.
const southY = mid(face(bathNorth, "north"), spineY); // 6535
const northY = mid(face(spine, "north"), northIn); //    7620
const width = mm(910);

// 7 goings of 280 mm on each flight: from the well's west edge to where the main stair turns.
const west = stairArrivalX;
const landingWest = spineEndX;

const lower = stairFlight("stair-flight-attic-lower", pt(west, northY), pt(landingWest, northY), { width, risers: atticStairRisers.lower });
const upper = stairFlight("stair-flight-attic-upper", pt(landingWest, southY), pt(west, southY), { width, risers: atticStairRisers.upper });

export const stairs: Stair[] = [
  { id: "stair-attic-lower", name: "Attic stair, lower flight", toStoreyId: "storey-attic-half-landing", segments: [lower] },
];

// The back wall runs across the landing's east edge, just outside it, up to the attic floor level
// where the attic's east roof slope comes down. It is a light stud wall carried on the landing; it
// stands over the main half landing, well above head height, so the main stair keeps its headroom.
const backWall = wall("wall-attic-half-landing-back", pt(coreW, stairSouthY), pt(coreW, stairNorthY), {
  thickness: studT,
  height: sub(atticFloor.elevation, atticHalfLanding.elevation),
  justification: "right",
});

export const atticHalfLandingStorey: Storey = {
  id: "storey-attic-half-landing",
  name: "Attic half landing",
  elevation: atticHalfLanding.elevation,
  walls: [backWall, ...atticHalfLandingWalls],
  openings: [],
  // The attic well stops at the core's east edge, so this half landing stays out of the extension.
  slabs: [{
    id: "slab-attic-half-landing",
    name: "Attic half landing",
    outline: [pt(landingWest, stairSouthY), pt(coreW, stairSouthY), pt(coreW, stairNorthY), pt(landingWest, stairNorthY)],
    thickness: mm(150),
    elevationOffset: mm(0),
  }, {
    // The reduced-height space behind the back wall, under the extension roof, floored at the
    // landing's level out to the extension walls' inner faces; the back wall stands on it.
    id: "slab-attic-half-landing-behind",
    name: "Attic half landing, behind the wall",
    outline: [pt(coreW, stairSouthY), pt(stairEastX, stairSouthY), pt(stairEastX, stairNorthY), pt(coreW, stairNorthY)],
    thickness: mm(150),
    elevationOffset: mm(0),
  }],
  rooms: [],
  stairs: [{ id: "stair-attic-upper", name: "Attic stair, upper flight", toStoreyId: "storey-attic", segments: [upper] }],
};
