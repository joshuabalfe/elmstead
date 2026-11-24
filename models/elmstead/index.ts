/**
 * Elmstead. 9.025 m × 8.425 m stone core with a brick extension at the rear, north-east corner.
 *
 *   shared.ts     outline, external wall thicknesses and floor levels used by every floor
 *   components/   door and window designs (doors.ts, windows.ts), shared by every floor
 *   ground/       ground floor: walls, openings, rooms, traced from the owner's plan image
 *   first/        first floor: traced from the owner's first-floor plan, with the stair well open
 *
 * The half landing and the stair flights still wait for the stair change; the stair well and half
 * landing are already left open in the first-floor slab.
 *
 * Plan axes follow the traced drawing: "north" in element ids (wall-north etc.) means the top of
 * the drawing. True north is roughly towards the plan's south-west corner, the one nearest the
 * large front window: 135° counter-clockwise from plan +y.
 */
import { defineBuilding, deg } from "../../src/model/index.js";
import { components } from "./components/index.js";
import { first } from "./first/index.js";
import { ground } from "./ground/index.js";

export default defineBuilding({
  project: { id: "project-elmstead", name: "Elmstead" },
  site: { id: "site-default", name: "Default site", northAngle: deg(135) },
  building: { id: "building-elmstead", name: "Elmstead" },
  components,
  storeys: [ground, first],
});
