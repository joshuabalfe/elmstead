/**
 * Elmstead. 9.025 m × 8.425 m stone core with a brick extension at the rear, north-east corner.
 *
 *   shared.ts     outline, external wall runs, thicknesses and floor levels used by every floor
 *   street.ts     external works: street level, ground slab and front steps
 *   components/   door and window designs (doors.ts, windows.ts), shared by every floor
 *   basement/     basement: traced from the owner's basement plan, stair well left open
 *   ground/       ground floor: walls, openings, rooms, traced from the owner's plan image
 *   first/        first floor: traced from the owner's first-floor plan, with the stair well open
 *   attic/        attic (top storey): empty floor and open stair well, layout awaiting the owner's plan
 *
 * The main stair (ground/stair.ts) climbs to the first floor, and the attic stair (first/stair.ts)
 * climbs over it to the attic, each through a well left open in the slab above. Each stair's half
 * landing is a storey of its own, defined with its stair, so walls can stand on it.
 *
 * Plan axes follow the traced drawing: "north" in element ids (wall-north etc.) means the top of
 * the drawing. True north is roughly towards the plan's south-west corner, the one nearest the
 * large front window: 135° counter-clockwise from plan +y.
 */
import { defineBuilding, deg } from "../../src/model/index.js";
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
  site: { id: "site-default", name: "Default site", northAngle: deg(135) },
  building: { id: "building-elmstead", name: "Elmstead" },
  components,
  storeys: [basement, street, ground, mainHalfLandingStorey, first, atticHalfLandingStorey, attic],
});
