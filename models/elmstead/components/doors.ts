/** Elmstead's door designs. Sizes are each door's own (../ground/openings.ts). */
import { doorComponent, mm } from "../../../src/backend/model/index.js";

/** The front door's frame; the owner measured 50 mm, within a 1 m opening. */
export const frontDoor = doorComponent("door-type-front", "Front door", { frame: { width: mm(50) } });
/** Every internal door, the narrow one in the lobby screen included. */
export const internalDoor = doorComponent("door-type-internal", "Internal door");
