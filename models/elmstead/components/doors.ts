/**
 * Elmstead's doors. The drawing gives widths only; heights are a typical 2.1 m. The bathroom door's
 * drawn gap (about 440 mm) is taken as the usual internal door.
 */
import { doorComponent, m, mm } from "../../../src/model/index.js";

export const frontDoor = doorComponent("door-type-front", "Front door", { width: mm(900), height: m(2.1) });
export const internalDoor = doorComponent("door-type-internal", "Internal door", { width: mm(700), height: m(2.1) });
/** The narrow door in the diagonal screen between the hallway and the lobby. */
export const lobbyDoor = doorComponent("door-type-lobby", "Lobby door", { width: mm(550), height: m(2.1) });
