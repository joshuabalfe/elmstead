/**
 * Elmstead's provisional half-turn stair, first floor to attic, stacked over the main stair inside
 * the attic's stair well (../attic/index.ts). Owner: 8 + 8 risers and a smaller half landing than
 * the main stair's. Over the provisional 2900 mm rise that is a 181.25 mm riser. You step on from
 * the first-floor landing, where the main stair arrives: the lower flight climbs east above the main
 * stair's lower flight, turns on a half landing at the core's east edge, and the upper flight climbs
 * west back to the attic's well edge. The goings are assumed at 280 mm, the main stair's upper
 * going, which leaves the half landing about 1 m deep; update them when the owner measures them.
 */
import { face, mm, pt, stairFlight, stairLanding, type Mm, type Stair } from "../../../src/model/index.js";
import { coreW } from "../shared.js";
import { bathNorth, northIn, spine, spineEndX, spineY } from "../ground/walls.js";
import { stairArrivalX, stairNorthY, stairSouthY } from "./walls.js";

// The flights keep the main stair's centrelines and width, so each sits over the flight below it.
const mid = (a: Mm, b: Mm): Mm => mm((a + b) / 2);
const southY = mid(face(bathNorth, "north"), spineY); // 6535
const northY = mid(face(spine, "north"), northIn); //    7620
const width = mm(910);
const risers = 8; // 8 + 8, from the owner

// 7 goings of 280 mm on each flight: from the well's west edge to where the main stair turns.
const west = stairArrivalX;
const landingWest = spineEndX;

const lower = stairFlight("stair-flight-attic-lower", pt(west, northY), pt(landingWest, northY), { width, risers });
// The attic well stops at the core's east edge, so this half landing stays out of the extension.
const halfLanding = stairLanding(
  "stair-landing-attic-half",
  [pt(landingWest, stairSouthY), pt(coreW, stairSouthY), pt(coreW, stairNorthY), pt(landingWest, stairNorthY)],
  { thickness: mm(150) },
);
const upper = stairFlight("stair-flight-attic-upper", pt(landingWest, southY), pt(west, southY), { width, risers });

export const stairs: Stair[] = [
  { id: "stair-attic", name: "Attic stair", toStoreyId: "storey-attic", segments: [lower, halfLanding, upper] },
];
