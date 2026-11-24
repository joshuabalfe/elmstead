/**
 * First-floor doors and windows: which component (../components), which wall, where along it, its
 * size, and which way doors swing. Rooms are traced from the owner's first-floor plan; sizes and
 * sill heights are typical unless the owner gives them.
 *
 * The half landing's window in the extension's east wall is left out: the half landing sits below
 * this floor, so the window belongs to the stair and half-landing model, not this storey.
 */
import { wallLength } from "../../../src/geometry/wall.js";
import { centredOn, deg, door, m, mm, window, type Opening } from "../../../src/model/index.js";
import { frontWindow, internalDoor, standardWindow } from "../components/index.js";
import { bayFront, bayNorth, baySouth, bedroomNorth, diningNorth, east, ensuiteSouth, kitchenEast, north } from "./walls.js";

const doorH = m(2.1);
const internal = { width: mm(700), height: doorH };
const standard = { height: m(1.2), sillHeight: mm(900) };
const lowLevel = { width: mm(700), height: mm(900), sillHeight: mm(500) };
const insideReveal = { face: "left", angle: deg(45) } as const;

const bayWindowWidth = mm(450);
const bayNorthOffset = mm(Math.round((wallLength(bayNorth) - bayWindowWidth) / 2));
const baySouthOffset = mm(Math.round((wallLength(baySouth) - bayWindowWidth) / 2));

export const openings: Opening[] = [
  // North wall runs east→west; "left" is inside.
  window("window-kitchen-north-first", north, mm(7250), standardWindow, lowLevel, insideReveal),

  // Bay window on the dining room's canted west side.
  window("window-bay-front-first", bayFront, centredOn(bayFront, mm(3390), mm(1500)), frontWindow, { width: mm(1500), height: mm(1800), sillHeight: mm(400) }),
  window("window-bay-north-first", bayNorth, bayNorthOffset, standardWindow, { ...standard, width: bayWindowWidth }),
  window("window-bay-south-first", baySouth, baySouthOffset, standardWindow, { ...standard, width: bayWindowWidth }),

  // Doors. Dining and bedroom doors open into their rooms; the ensuite door opens from the bedroom.
  door("door-dining-first", diningNorth, mm(3400), internalDoor, internal, { hinge: "end", side: "right" }),
  door("door-bedroom-first", bedroomNorth, mm(115), internalDoor, { width: mm(800), height: doorH }, { hinge: "start", side: "right" }),
  door("door-ensuite-first", ensuiteSouth, mm(350), internalDoor, { width: mm(800), height: doorH }, { hinge: "start", side: "left" }),
  // Kitchen door sits just below the north wall; "left" is the kitchen.
  door("door-kitchen-first", kitchenEast, mm(700), internalDoor, internal, { hinge: "end", side: "left" }),

  // East wall runs south→north; the window sits south of the ensuite wall, so no splayed reveal.
  window("window-bedroom-first", east, mm(2275), standardWindow, { ...standard, width: mm(1200) }),
];