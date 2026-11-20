/** Elmstead's door designs. Sizes are each door's own (../ground/openings.ts). */
import { doorComponent } from "../../../src/model/index.js";

export const frontDoor = doorComponent("door-type-front", "Front door");
/** Every internal door, the narrow one in the lobby screen included. */
export const internalDoor = doorComponent("door-type-internal", "Internal door");
