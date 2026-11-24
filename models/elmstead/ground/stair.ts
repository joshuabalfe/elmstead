/**
 * Elmstead's provisional half-turn stair, ground to first floor. The ground plan reserves the
 * stairwell: two 910 mm flights (owner) either side of the spine wall, turning at the east end over
 * a half landing. You enter from the hallway: the lower flight north of the spine climbs east, and
 * the upper flight south of it climbs west back over the lobby. The spine stops at the landing so
 * the turn is clear; the real stair may turn on winders, which the schema does not model yet. No
 * elevations are stored: the 3100 mm rise comes from the two storeys, so tracing the first floor
 * later re-derives the stair.
 */
import { face, mm, pt, stairFlight, stairLanding, type Mm, type Stair } from "../../../src/model/index.js";
import { bathNorth, bathWestX, northIn, spine, spineEastX, spineEndX, spineY } from "./walls.js";

const stairSouth = face(bathNorth, "north"); // 6080: south flight's south edge, the bathroom wall
const spineNorth = face(spine, "north"); //    7165: north flight's south edge, the spine's far face
const mid = (a: Mm, b: Mm): Mm => mm((a + b) / 2);
const southY = mid(stairSouth, spineY); //  6535: centreline of the flight south of the spine
const northY = mid(spineNorth, northIn); // 7620: centreline of the flight north of the spine
const width = mm(910); // both flights, from the owner

// Bottom-to-top: enter from the hallway, climb east north of the spine, turn over the half landing,
// then climb west south of it.
const lower = stairFlight("stair-flight-lower", pt(bathWestX, northY), pt(spineEndX, northY), { width, risers: 9 });
const halfLanding = stairLanding(
  "stair-landing-half",
  [pt(spineEndX, stairSouth), pt(spineEastX, stairSouth), pt(spineEastX, northIn), pt(spineEndX, northIn)],
  { thickness: mm(150) },
);
const upper = stairFlight("stair-flight-upper", pt(spineEndX, southY), pt(bathWestX, southY), { width, risers: 9 });

export const stairs: Stair[] = [
  { id: "stair-main", name: "Main stair", toStoreyId: "storey-first-floor", segments: [lower, halfLanding, upper] },
];
