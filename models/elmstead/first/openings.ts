/**
 * First-floor doors and windows: which component (../components), which wall, where along it, its
 * size, and which way doors swing. Rooms are traced from the owner's first-floor plan; sizes and
 * sill heights are typical unless the owner gives them.
 *
 * The half landing's window in the extension's rear wall is on the main half landing's storey
 * (../ground/stair.ts), which holds the extension's walls at that level.
 */
import { wallLength } from "../../../src/shared/geometry/wall.js";
import { add, divRound, door, doorway, m, mm, sub, window, type Opening } from "../../../src/backend/model/index.js";
import { bayWindow, crossBarWindow, crossWindow, internalDoor } from "../components/index.js";
import { frontDoorOffset, frontDoorWidth } from "../ground/openings.js";
import {
  bayFront,
  bayLeft,
  bayRight,
  bedroomLeft,
  diningLeft,
  rear,
  ensuiteRight,
  kitchenRear,
  frontLeft,
} from "./walls.js";

const doorH = m(2.1);
const internal = { width: mm(768), height: doorH };

const bayWindowSize = { height: mm(2100), sillHeight: mm(450) };
// Each light fills its wall segment, so only the window frames meet at the corners.
const bayFrontWidth = mm(Math.floor(wallLength(bayFront)));
const baySideWidth = mm(Math.floor(wallLength(bayLeft)));

// Centred over the 1 m front door, which keeps this wider window close to the front-left corner.
const kitchenWindowWidth = mm(1210);
const kitchenWindowOffset = add(frontDoorOffset, divRound(sub(frontDoorWidth, kitchenWindowWidth), 2));

// The rear bedroom window's left jamb runs into the corner against the ensuite's right wall.
const bedroomWindowWidth = mm(1100);
const bedroomWindowOffset = sub(sub(ensuiteRight.start.y, rear.start.y), bedroomWindowWidth);

// The ensuite's longer front wall leaves an 885 mm entrance strip, so the bedroom door is centred.
const bedroomDoorWidth = internal.width;
const bedroomDoorOffset = divRound(sub(mm(wallLength(bedroomLeft)), bedroomDoorWidth), 2);

// The kitchen door sits close to the party wall, with a 50 mm jamb.
const kitchenDoorWidth = internal.width;
const kitchenDoorOffset = sub(sub(mm(wallLength(kitchenRear)), kitchenDoorWidth), mm(50));
// The dining doorway keeps a 50 mm jamb to the partition too (chosen for the join; the traced
// offset was 3400).
const diningDoorwayOffset = sub(sub(mm(wallLength(diningLeft)), internal.width), mm(50));

export const openings: Opening[] = [
  // Front wall runs plan north→south; "left" is inside. The kitchen window is 1.21 × 2.1 m, centred
  // over the front door and close to the front-left corner. Its 450 mm sill is the owner's. A
  // square reveal keeps the frame and its cut inside the wall this close to the corner.
  window("window-kitchen-front-first", frontLeft, kitchenWindowOffset, crossWindow, {
    width: kitchenWindowWidth,
    height: mm(2100),
    sillHeight: mm(450),
  }),

  // Bay windows on the dining room's canted front side: all three share a 450 mm sill and reach
  // the bay ceiling at 2.55 m. Each fills its wall, so only the frames meet at the corners. The
  // middle light has one vertical and one horizontal bar; the sides only the horizontal.
  window("window-bay-front-first", bayFront, mm(0), bayWindow, { width: bayFrontWidth, ...bayWindowSize }),
  window("window-bay-left-first", bayLeft, mm(0), crossBarWindow, { ...bayWindowSize, width: baySideWidth }),
  window("window-bay-right-first", bayRight, mm(0), crossBarWindow, { ...bayWindowSize, width: baySideWidth }),

  // The dining room's doorway to the landing has no leaf and takes the same 768 mm opening as the
  // internal doors; the bedroom door opens into its room and the ensuite door opens from the
  // bedroom.
  doorway("door-dining-first", diningLeft, diningDoorwayOffset, internal),
  door("door-bedroom-first", bedroomLeft, bedroomDoorOffset, internalDoor, internal, { hinge: "start", side: "right" }),
  door("door-ensuite-first", ensuiteRight, mm(350), internalDoor, internal, { hinge: "start", side: "left" }),
  // Kitchen door sits 50 mm off the party wall; "left" is the kitchen.
  door(
    "door-kitchen-first",
    kitchenRear,
    kitchenDoorOffset,
    internalDoor,
    { width: kitchenDoorWidth, height: doorH },
    { hinge: "end", side: "left" },
  ),

  // Rear wall runs plan south→north. The rear bedroom window is 1.1 × 1.95 m with a 500 mm sill
  // (owner), a cross-bar frame like the other windows, and its left jamb tight against the
  // ensuite's right wall. A square reveal lets the opening run into the corner.
  window("window-bedroom-first", rear, bedroomWindowOffset, crossBarWindow, {
    width: bedroomWindowWidth,
    height: mm(1950),
    sillHeight: mm(500),
  }),
];
