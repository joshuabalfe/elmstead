/**
 * Elmstead's windows. The front window and fanlight sizes are the owner's; the others are typical
 * 1.2 m sashes at the widths the drawing shows.
 */
import { add, m, mm, sub, windowComponent } from "../../../src/model/index.js";
import { frontDoor } from "./doors.js";

/** Height above the floor of the front window's head, which the fanlight's head lines up with. */
export const frontHead = m(2.6);
/** Between the top of the front door and the fanlight above it. */
export const transom = mm(100);

/** The large front window: 2.5 m wide, 0.5 m sill, head at 2.6 m. */
export const frontWindow = windowComponent("window-type-front", "Front window", { width: m(2.5), height: sub(frontHead, mm(500)) });
/** Glazed panel over the front door: the door's width, from the transom up to the front window's head. */
export const fanlight = windowComponent("window-type-fanlight", "Fanlight", { width: frontDoor.width, height: sub(frontHead, add(frontDoor.height, transom)) });
export const bedroomWindow = windowComponent("window-type-bedroom", "Bedroom window", { width: mm(1050), height: m(1.2) });
export const rearHallWindow = windowComponent("window-type-rear-hall", "Rear hall window", { width: mm(950), height: m(1.2) });
