/**
 * Basement doors and windows: which component (../components), which wall, where along it, its size,
 * and which way doors swing. Sizes are typical (door 2.1 m, window 1.2 m on a 900 mm sill) except
 * the back door, which the drawing labels "Reduced Height" — taken as 1.8 m here. The garden room's
 * east opening is a pair of doors to the outside. Positions are traced; widths chosen, not measured.
 */
import { centredOn, door, m, mm, window, type Opening } from "../../../src/model/index.js";
import { internalDoor, standardWindow } from "../components/index.js";
import { central, east, extEast, northBedEast, showerNorth, west } from "./walls.js";

const doorH = m(2.1);
const internal = { width: mm(700), height: doorH };
const standard = { height: m(1.2), sillHeight: mm(900) };
const windowW = mm(1200);
const gardenDoor = { width: mm(750), height: doorH };

export const openings: Opening[] = [
  // West wall runs north→south; "start" is the north end and "left" is inside.
  door("door-hallway-basement", west, mm(150), internalDoor, { width: mm(900), height: doorH }, { hinge: "start", side: "left" }),
  window("window-guest-north-basement", west, centredOn(west, mm(5650), windowW), standardWindow, { ...standard, width: windowW }),
  // Bedroom 2's window is 1650 wide (owner), set close to the divide wall it shares with Bedroom 1.
  window("window-guest-south-basement", west, centredOn(west, mm(3300), mm(1650)), standardWindow, { ...standard, width: mm(1650) }),

  // Central partition runs north→south; "left" is the garden room. Centred at the same height as
  // Bedroom 2's door so the two face each other directly across the corridor.
  door("door-garden-basement", central, centredOn(central, mm(3700), internal.width), internalDoor, internal, { hinge: "start", side: "left" }),
  // Both bedrooms open off the hallway through the corridor's west edge wall (northBedEast), which
  // runs north→south; "right" is west, into the bedroom. Bedroom 2's door is in its north-east leg.
  door("door-guest-north-basement", northBedEast, centredOn(northBedEast, mm(5500), internal.width), internalDoor, internal, { hinge: "end", side: "right" }),
  door("door-guest-south-basement", northBedEast, centredOn(northBedEast, mm(3700), internal.width), internalDoor, internal, { hinge: "end", side: "right" }),
  // Shower north wall runs west→east; "right" is the shower room.
  door("door-shower-basement", showerNorth, centredOn(showerNorth, mm(4100), internal.width), internalDoor, internal, { hinge: "start", side: "right" }),

  // Garden room east wall runs south→north; "left" is inside. A pair of doors to the outside.
  door("door-garden-south-basement", east, centredOn(east, mm(2725), gardenDoor.width), internalDoor, gardenDoor, { hinge: "start", side: "left" }),
  door("door-garden-north-basement", east, centredOn(east, mm(3475), gardenDoor.width), internalDoor, gardenDoor, { hinge: "end", side: "left" }),

  // Extension east wall runs south→north; "left" is inside. The reduced-height back door.
  door("door-back-basement", extEast, mm(300), internalDoor, { width: mm(800), height: mm(1800) }, { hinge: "start", side: "left" }),
];
