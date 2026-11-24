/** Elmstead's door and window components (the building's `components`), one file per kind. */
import type { Components } from "../../../src/model/index.js";
import { frontDoor, internalDoor } from "./doors.js";
import { bayWindow, crossBarWindow, fanlight, frontWindow, standardWindow } from "./windows.js";

export * from "./doors.js";
export * from "./windows.js";

export const components: Components = {
  doors: [frontDoor, internalDoor],
  windows: [frontWindow, bayWindow, crossBarWindow, fanlight, standardWindow],
};
