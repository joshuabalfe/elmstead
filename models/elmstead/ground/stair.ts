/**
 * Elmstead's provisional half-turn stair, ground to first floor, fitted to the traced first-floor
 * stair well (which runs east into the extension). Owner: 17 risers of about 180 mm; steps 320 mm
 * deep on the lower flight and 280 mm on the upper. Over the provisional 3100 mm rise that is a
 * 182 mm riser; the 17 split 9 + 8, and the runs follow each flight's going (2560 and 1960). You
 * enter from the hallway: the lower flight north of the spine climbs east, turns over the half
 * landing in the extension, and the upper flight south of the spine climbs west back to the
 * first-floor landing.
 *
 * The half landing is a storey of its own (../shared.ts), so the stair is two: the lower flight
 * climbs from the ground floor to the half landing, and the upper flight from the half landing to
 * the first floor. No elevations are stored here: measuring the levels later re-derives the riser.
 */
import { face, mm, pt, stairFlight, type Mm, type Stair, type Storey } from "../../../src/model/index.js";
import { stairwellOutline } from "../first/index.js";
import { stairArrivalX } from "../first/walls.js";
import { mainHalfLanding, mainStairRisers } from "../shared.js";
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

// Bottom-to-top: enter from the hallway, climb east north of the spine, turn over the half landing
// in the extension, then climb west south of it to the first-floor landing. Each flight's run is its
// going × (risers − 1): 320 mm steps below, 280 mm above.
const lower = stairFlight("stair-flight-lower", pt(west, northY), pt(landingWest, northY), { width, risers: mainStairRisers.lower });
const upper = stairFlight("stair-flight-upper", pt(landingWest, southY), pt(stairArrivalX, southY), { width, risers: mainStairRisers.upper });

export const stairs: Stair[] = [
  { id: "stair-main-lower", name: "Main stair, lower flight", toStoreyId: "storey-main-half-landing", segments: [lower] },
];

export const mainHalfLandingStorey: Storey = {
  id: "storey-main-half-landing",
  name: "Main half landing",
  elevation: mainHalfLanding.elevation,
  walls: [],
  openings: [],
  // The half landing wraps around the spine's traced east end: the spine strip is notched out of
  // its west part so the wall keeps its full length without passing through the landing.
  slabs: [{
    id: "slab-main-half-landing",
    name: "Main half landing",
    outline: [
      pt(landingWest, south),
      pt(east, south),
      pt(east, north),
      pt(landingWest, north),
      pt(landingWest, spineNorth),
      pt(spineEastX, spineNorth),
      pt(spineEastX, spineY),
      pt(landingWest, spineY),
    ],
    thickness: mm(150),
    elevationOffset: mm(0),
  }],
  rooms: [],
  stairs: [{ id: "stair-main-upper", name: "Main stair, upper flight", toStoreyId: "storey-first-floor", segments: [upper] }],
};
