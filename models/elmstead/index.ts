/**
 * Elmstead. 8 m × 7.4 m stone core with a brick extension at the rear, north-east corner.
 *
 *   shared.ts   outline, external wall thicknesses and floor levels used by every floor
 *   ground.ts   ground floor, traced from the owner's ground-floor plan image (first pass)
 *
 * Upper floors to follow, one file per storey.
 *
 * Plan axes follow the traced drawing: "north" in element ids (wall-north etc.) means the top of
 * the drawing. True north is roughly towards the plan's south-west corner, the one nearest the
 * large front window: 135° counter-clockwise from plan +y.
 */
import { defineBuilding, deg } from "../../src/model/index.js";
import { ground } from "./ground.js";

export default defineBuilding({
  project: { id: "project-elmstead", name: "Elmstead" },
  site: { id: "site-default", name: "Default site", northAngle: deg(135) },
  building: { id: "building-elmstead", name: "Elmstead" },
  storeys: [ground],
});
