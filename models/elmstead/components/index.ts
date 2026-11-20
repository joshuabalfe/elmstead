/** Elmstead's door and window components (the building's `components`), one file per kind. */
import type { Components } from "../../../src/model/index.js";
import { frontDoor, internalDoor, lobbyDoor } from "./doors.js";
import { bedroomWindow, fanlight, frontWindow, rearHallWindow } from "./windows.js";

export * from "./doors.js";
export * from "./windows.js";

export const components: Components = {
  doors: [frontDoor, internalDoor, lobbyDoor],
  windows: [frontWindow, fanlight, bedroomWindow, rearHallWindow],
};
