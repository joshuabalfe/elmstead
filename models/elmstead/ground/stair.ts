/**
 * Elmstead's provisional half-turn stair, ground to first floor, fitted to the traced first-floor
 * stair well (which runs east into the extension). Owner: 17 risers of about 180 mm and steps about
 * 320 mm deep. Over the provisional 3100 mm rise that is a 182 mm riser; the 17 split 9 + 8, and to
 * keep every going at 320 mm the two runs stagger (2560 and 2240). You enter from the hallway: the
 * lower flight north of the spine climbs east, turns over the half landing in the extension, and the
 * upper flight south of the spine climbs west back to the first-floor landing. No elevations are
 * stored: measuring the levels later re-derives the riser height.
 */
import { face, mm, pt, stairFlight, stairLanding, type Mm, type Stair } from "../../../src/model/index.js";
import { stairwellOutline } from "../first/index.js";
import { stairArrivalX } from "../first/walls.js";
import { bathNorth, northIn, spine, spineEastX, spineEndX, spineY } from "./walls.js";

// The traced first-floor well bounds the flights and landing; the half landing fills its east end
// (the extension), from the spine's end to the well's east edge.
const xs = stairwellOutline.map((p) => p.x);
const ys = stairwellOutline.map((p) => p.y);
const west = spine.start.x; // the stair bottom aligns with the spine's start, by the lobby door
const east = mm(Math.max(...xs));
const south = mm(Math.min(...ys));
const north = mm(Math.max(...ys));
const landingWest = spineEndX;

const spineNorth = face(spine, "north"); //    7165: north flight's south edge, the spine's far face
const mid = (a: Mm, b: Mm): Mm => mm((a + b) / 2);
const southY = mid(face(bathNorth, "north"), spineY); // 6535: centreline south of the spine
const northY = mid(spineNorth, northIn); //              7620: centreline north of the spine
const width = mm(910); // both flights, from the owner
const lowerRisers = 9;
const upperRisers = 8; // 17 total, from the owner

// Bottom-to-top: enter from the hallway, climb east north of the spine, turn over the half landing
// in the extension, then climb west south of it to the first-floor landing. Runs are going ×
// (risers − 1) so every step is 320 mm deep; the odd riser count staggers the two runs.
const lower = stairFlight("stair-flight-lower", pt(west, northY), pt(landingWest, northY), { width, risers: lowerRisers });
// The half landing wraps around the spine's traced east end: the spine strip is notched out of its
// west part so the wall keeps its full length without passing through the landing.
const halfLanding = stairLanding(
  "stair-landing-half",
  [
    pt(landingWest, south),
    pt(east, south),
    pt(east, north),
    pt(landingWest, north),
    pt(landingWest, spineNorth),
    pt(spineEastX, spineNorth),
    pt(spineEastX, spineY),
    pt(landingWest, spineY),
  ],
  { thickness: mm(150) },
);
const upper = stairFlight("stair-flight-upper", pt(landingWest, southY), pt(stairArrivalX, southY), { width, risers: upperRisers });

export const stairs: Stair[] = [
  { id: "stair-main", name: "Main stair", toStoreyId: "storey-first-floor", segments: [lower, halfLanding, upper] },
];
