/**
 * Elmstead's provisional half-turn stair, ground to first floor, fitted to the traced first-floor
 * stair well (which runs east into the extension). You enter from the hallway: the lower flight
 * north of the spine climbs east, turns over the half landing in the extension, and the upper flight
 * south of the spine climbs west back to the first-floor landing. The spine divides the flights as
 * far as its traced east end; the turn and landing lie east of it. No elevations are stored: the
 * 3100 mm rise comes from the two storeys, so measuring the levels later re-derives the stair.
 */
import { face, mm, pt, stairFlight, stairLanding, type Mm, type Stair } from "../../../src/model/index.js";
import { stairwellOutline } from "../first/index.js";
import { coreW } from "../shared.js";
import { bathNorth, northIn, spine, spineY } from "./walls.js";

// The traced first-floor well bounds the flights and landing; the half landing fills its east end
// (the extension), from the core's east wall to the well's east edge.
const xs = stairwellOutline.map((p) => p.x);
const ys = stairwellOutline.map((p) => p.y);
const west = mm(Math.min(...xs));
const east = mm(Math.max(...xs));
const south = mm(Math.min(...ys));
const north = mm(Math.max(...ys));
const landingWest = coreW;

const spineNorth = face(spine, "north"); //    7165: north flight's south edge, the spine's far face
const mid = (a: Mm, b: Mm): Mm => mm((a + b) / 2);
const southY = mid(face(bathNorth, "north"), spineY); // 6535: centreline south of the spine
const northY = mid(spineNorth, northIn); //              7620: centreline north of the spine
const width = mm(910); // both flights, from the owner

// Bottom-to-top: enter from the hallway, climb east north of the spine, turn over the half landing
// in the extension, then climb west south of it to the first-floor landing.
const lower = stairFlight("stair-flight-lower", pt(west, northY), pt(landingWest, northY), { width, risers: 10 });
const halfLanding = stairLanding(
  "stair-landing-half",
  [pt(landingWest, south), pt(east, south), pt(east, north), pt(landingWest, north)],
  { thickness: mm(150) },
);
const upper = stairFlight("stair-flight-upper", pt(landingWest, southY), pt(west, southY), { width, risers: 10 });

export const stairs: Stair[] = [
  { id: "stair-main", name: "Main stair", toStoreyId: "storey-first-floor", segments: [lower, halfLanding, upper] },
];
