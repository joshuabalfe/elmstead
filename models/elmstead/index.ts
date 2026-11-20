/**
 * Elmstead. 8 m × 7.4 m stone core with a brick extension at the rear, north-east corner.
 *
 *   shared.ts   outline, external wall thicknesses and floor levels used by every floor
 *   ground.ts   ground floor, traced from the owner's ground-floor plan image (first pass)
 *
 * Upper floors to follow, one file per storey.
 */
import { defineBuilding } from "../../src/model/index.js";
import { ground } from "./ground.js";

export default defineBuilding({
  project: { id: "project-elmstead", name: "Elmstead" },
  site: { id: "site-default", name: "Default site" },
  building: { id: "building-elmstead", name: "Elmstead" },
  storeys: [ground],
});
