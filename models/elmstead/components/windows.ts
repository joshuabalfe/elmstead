/** Elmstead's window designs. Sizes are each window's own (../ground/openings.ts). */
import { windowComponent } from "../../../src/model/index.js";

/** The large front window. */
export const frontWindow = windowComponent("window-type-front", "Front window");
/** The glazed panel over the front door: a different construction from the front window. */
export const fanlight = windowComponent("window-type-fanlight", "Fanlight");
/** The bedroom and rear-hall windows. */
export const standardWindow = windowComponent("window-type-standard", "Standard window");
