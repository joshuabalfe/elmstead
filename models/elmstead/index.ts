/**
 * Elmstead. 9.025 m × 8.425 m stone core with a brick extension at the rear, on the party-wall side.
 *
 *   shared.ts     outline, external wall runs, thicknesses and floor levels used by every floor
 *   street.ts     external works: street level, ground slab and front steps
 *   components/   door and window designs (doors.ts, windows.ts), shared by every floor
 *   basement/     basement: traced from the owner's basement plan, stair well left open
 *   ground/       ground floor: walls, openings, rooms, traced from the owner's plan image
 *   first/        first floor: traced from the owner's first-floor plan, with the stair well open
 *   extension.ts  the split-level rear extension's walls, on the half-landing storeys
 *   attic/        attic (top storey): empty floor and open stair well, layout awaiting the owner's plan
 *
 * The main stair (ground/stair.ts) climbs to the first floor, and the attic stair (first/stair.ts)
 * climbs over it to the attic, each through a well left open in the slab above. Each stair's half
 * landing is a storey of its own, defined with its stair, so walls can stand on it.
 *
 * Plan axes follow the traced drawing, and ids use building sides (front, rear, party, end, left,
 * right); shared.ts maps one to the other. True north is 153° counter-clockwise from plan +y, so
 * the front faces about 063° (east-north-east).
 */
import { defineBuilding, deg } from "../../src/backend/model/index.js";
import { attic } from "./attic/index.js";
import { basement } from "./basement/index.js";
import { components } from "./components/index.js";
import { first } from "./first/index.js";
import { atticHalfLandingStorey } from "./first/stair.js";
import { ground } from "./ground/index.js";
import { mainHalfLandingStorey } from "./ground/stair.js";
import { street } from "./street.js";

export default defineBuilding({
  project: { id: "project-elmstead", name: "Elmstead" },
  // Measured from a north-up street map of Picton Rd: the terrace frontage bears about 153°/333°,
  // so the front faces about 063° (east-north-east). Good to about ±2°.
  site: { id: "site-default", name: "Default site", northAngle: deg(153) },
  building: { id: "building-elmstead", name: "Elmstead" },
  components,
  storeys: [basement, street, ground, mainHalfLandingStorey, first, atticHalfLandingStorey, attic],
});
