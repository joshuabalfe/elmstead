/**
 * First-floor walls, traced from the owner's first-floor plan. The drawing is about 7.9 mm per px,
 * rounded to 25 mm. External walls stack on the ground floor's; the kitchen/dining wall and the
 * dining/bedroom partition keep the ground floor's measured positions.
 *
 * The stair runs up the south flight, turns on the half landing in the extension, and comes back
 * west along the north flight to the landing. The stair well is left open; the flights themselves
 * belong to the stair change.
 */
import { add, face, mm, pt, sub, wall } from "../../../src/model/index.js";
import { brickT, coreD, coreW, eastT, extEastX, extSouthY, firstFloor, northT, partT, southT, studT, westT } from "../shared.js";
import { livingBreast, partitionEast, partitionX } from "../ground/walls.js";

export const wallH = firstFloor.ceilingHeight;
export const breastDepth = mm(350); // chimney breasts, as on the ground floor

// ── Traced plan positions ────────────────────────────────────────────────────
// Kitchen, north-west; its east wall steps east above the dining-room wall.
export const kitchenSouthY = mm(5325); // kitchen face of the kitchen/dining wall; 2.75 m below the north wall (owner)
export const diningNorthY = mm(5150); //  dining face of the kitchen/dining wall; 4.55 m above the chimney breast (owner)
export const kitchenEastX = mm(4150); // west face of the kitchen's east wall, above the step
export const kitchenEastFaceX = add(kitchenEastX, partT);
export const kitchenEastLowerX = mm(3400); // west face of its return below the step
export const passageWestX = add(kitchenEastLowerX, partT);
export const kitchenStepY = mm(6475); // kitchen face of the step wall
export const stepSouthY = sub(kitchenStepY, partT); // landing face of the step wall

// Dining room, south-west, with a canted bay window in the west wall.
export const bayNorthY = mm(4775);
export const baySouthY = mm(2005);
export const bayFrontNorthY = mm(4315);
export const bayFrontSouthY = mm(2465);
export const bayOutX = mm(-450);

// Ensuite in the bedroom's north-east corner.
export const bedroomNorthY = mm(5375); // bedroom face of its north wall
export const bedroomNorthFaceY = add(bedroomNorthY, partT);
export const ensuiteWestX = mm(5875);
export const ensuiteWestFaceX = add(ensuiteWestX, partT);
export const ensuiteSouthY = mm(3815); // bedroom face of the ensuite's south wall; the room is 1.91 m wide to the extension wall (owner)
export const ensuiteSouthFaceY = add(ensuiteSouthY, partT);

// ── External walls, on the ground floor's walls below ───────────────────────
export const north = wall("wall-north-first", pt(extEastX, coreD), pt(mm(0), coreD), { thickness: northT, height: wallH, justification: "left" });
export const south = wall("wall-south-first", pt(mm(0), mm(0)), pt(coreW, mm(0)), { thickness: southT, height: wallH, justification: "left" });
export const southIn = face(south, "north");
export const northIn = face(north, "south");
export const breastNorthY = add(southIn, breastDepth);
export const bedroomBreastWestX = mm(7850);

export const westNorth = wall("wall-west-first-north", pt(mm(0), northIn), pt(mm(0), bayNorthY), { thickness: westT, height: wallH, justification: "left" });
export const westSouth = wall("wall-west-first-south", pt(mm(0), baySouthY), pt(mm(0), southIn), { thickness: westT, height: wallH, justification: "left" });
export const westIn = face(westNorth, "east");

export const east = wall("wall-east-first", pt(coreW, southIn), pt(coreW, extSouthY), { thickness: eastT, height: wallH, justification: "left" });
export const eastIn = face(east, "west");
export const extEast = wall("wall-extension-east-first", pt(extEastX, extSouthY), pt(extEastX, northIn), { thickness: brickT, height: wallH, justification: "left" });
export const extSouth = wall("wall-extension-south-first", pt(coreW, extSouthY), pt(face(extEast, "west"), extSouthY), { thickness: brickT, height: wallH, justification: "left" });

// ── Bay window, west side of the dining room ────────────────────────────────
// Lines are the bay's outer edge; its sides meet the west wall's outer face. Its ceiling is
// 150 mm below the room's, and the lights run up to it, so no wall shows above them.
const bayH = sub(wallH, mm(150));
export const bayNorth = wall("wall-bay-north-first", pt(mm(0), bayNorthY), pt(bayOutX, bayFrontNorthY), { thickness: studT, height: bayH, justification: "centre" });
export const bayFront = wall("wall-bay-front-first", pt(bayOutX, bayFrontNorthY), pt(bayOutX, bayFrontSouthY), { thickness: studT, height: bayH, justification: "centre" });
export const baySouth = wall("wall-bay-south-first", pt(bayOutX, bayFrontSouthY), pt(mm(0), baySouthY), { thickness: studT, height: bayH, justification: "centre" });

// ── Internal walls ──────────────────────────────────────────────────────────
// Kitchen/dining wall, and the kitchen's east wall above the step.
export const diningNorth = wall("wall-dining-north-first", pt(westIn, kitchenSouthY), pt(partitionX, kitchenSouthY), { thickness: partT, height: wallH, justification: "right" });
export const kitchenEast = wall("wall-kitchen-east-first", pt(kitchenEastX, kitchenStepY), pt(kitchenEastX, northIn), { thickness: partT, height: wallH, justification: "right" });
export const kitchenEastLower = wall("wall-kitchen-east-lower-first", pt(kitchenEastLowerX, diningNorthY), pt(kitchenEastLowerX, kitchenStepY), { thickness: partT, height: wallH, justification: "right" });
export const kitchenStep = wall("wall-kitchen-step-first", pt(kitchenEastLowerX, kitchenStepY), pt(kitchenEastFaceX, kitchenStepY), { thickness: partT, height: wallH, justification: "right" });

// Dining/bedroom partition, on the ground floor's.
export const diningBedroom = wall("wall-dining-bedroom-first", pt(partitionX, southIn), pt(partitionX, bedroomNorthY), { thickness: partT, height: wallH, justification: "right" });

// Bedroom north wall, and the ensuite in its north-east corner.
export const bedroomNorth = wall("wall-bedroom-north-first", pt(partitionEast, bedroomNorthY), pt(ensuiteWestX, bedroomNorthY), { thickness: partT, height: wallH, justification: "left" });
export const ensuiteWest = wall("wall-ensuite-west-first", pt(ensuiteWestX, ensuiteSouthY), pt(ensuiteWestX, extSouthY), { thickness: partT, height: wallH, justification: "right" });
export const ensuiteSouth = wall("wall-ensuite-south-first", pt(ensuiteWestX, ensuiteSouthY), pt(eastIn, ensuiteSouthY), { thickness: partT, height: wallH, justification: "left" });
// Under the stairs, level with the extension's south wall, so the whole stair well reads as one wall.
export const ensuiteNorth = wall("wall-ensuite-north-first", pt(ensuiteWestX, extSouthY), pt(coreW, extSouthY), { thickness: partT, height: wallH, justification: "left" });

// The stair well and half landing fill one rectangle to the walls' inner faces: the ensuite west
// wall, the extension east wall, the ensuite north wall and the north wall.
export const stairWestX = ensuiteWestX;
export const stairEastX = sub(extEastX, brickT);
export const stairSouthY = add(extSouthY, brickT);
export const stairNorthY = northIn;

// The upper flight is one going shorter (17 risers split 9 + 8), so its top riser lands east of the
// well's west edge. The landing sticks out to meet it across the south flight's band, leaving no
// gap to step into.
export const stairArrivalX = mm(6050);

// Chimney breasts on the south wall: the dining-room one stacks on the living room's.
export const breastDining = wall("wall-breast-dining-first", pt(livingBreast.west, southIn), pt(livingBreast.east, southIn), { thickness: breastDepth, height: wallH, justification: "left" });
export const breastBedroom = wall("wall-breast-bedroom-first", pt(bedroomBreastWestX, southIn), pt(eastIn, southIn), { thickness: breastDepth, height: wallH, justification: "left" });

export const walls = [
  north,
  south,
  westNorth,
  westSouth,
  east,
  extEast,
  extSouth,
  bayNorth,
  bayFront,
  baySouth,
  diningNorth,
  kitchenEast,
  kitchenEastLower,
  kitchenStep,
  diningBedroom,
  bedroomNorth,
  ensuiteWest,
  ensuiteSouth,
  ensuiteNorth,
  breastDining,
  breastBedroom,
];