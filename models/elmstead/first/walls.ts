/**
 * First-floor walls, traced from the owner's first-floor plan. The drawing is about 7.9 mm per px,
 * rounded to 25 mm. External walls stack on the ground floor's; the kitchen/dining wall and the
 * dining/bedroom partition keep the ground floor's measured positions.
 *
 * The stair runs up the right flight, turns on the half landing in the extension, and comes back
 * towards the front along the left flight to the landing. The stair well is left open; the flights
 * are in ../ground/stair.ts, and the attic stair above them in ./stair.ts.
 */
import { add, face, mm, pt, sub, wall } from "../../../src/model/index.js";
import { brickT, coreD, coreW, extRearX, extRightY, externalRuns, externalWall, firstFloor, partT, studT, frontT } from "../shared.js";
import { livingBreast, partitionRear, partitionX } from "../ground/walls.js";

export const wallH = firstFloor.ceilingHeight;
export const breastDepth = mm(350); // chimney breasts, as on the ground floor

// ── Traced plan positions ────────────────────────────────────────────────────
// Kitchen, front-left; its rear wall steps towards the rear above the dining-room wall.
export const kitchenRightY = mm(5325); // kitchen face of the kitchen/dining wall; 2.75 m below the party wall (owner)
export const diningLeftY = mm(5150); //  dining face of the kitchen/dining wall; 4.55 m above the chimney breast (owner)
export const kitchenRearLowerX = mm(3400); // front face of its return below the step
export const passageFrontX = add(kitchenRearLowerX, partT);
export const kitchenRearFaceX = add(passageFrontX, mm(1100)); // rear face above the step; the return's internal length is 1.1 m (owner)
export const kitchenRearX = sub(kitchenRearFaceX, partT); // front face of the kitchen's rear wall, above the step
export const kitchenStepY = add(kitchenRightY, mm(1250)); // kitchen face of the step wall, 1.25 m into the kitchen (owner)
export const stepRightY = sub(kitchenStepY, partT); // landing face of the step wall

// Dining room, front-right, with a canted bay window in the front wall.
export const bayLeftY = mm(4775);
export const bayRightY = mm(2005);
export const bayFrontLeftY = mm(4315);
export const bayFrontRightY = mm(2465);
export const bayOutX = mm(-450);

// Ensuite in the bedroom's rear-left corner.
export const bedroomLeftY = mm(5375); // bedroom face of its left wall
export const bedroomLeftFaceY = add(bedroomLeftY, partT);
export const ensuiteFrontX = mm(5710); // ensuite 2.79 m long front to back (owner); the bedroom's entrance strip narrows to 885 mm
export const ensuiteFrontFaceX = add(ensuiteFrontX, partT);
export const ensuiteRightY = mm(3815); // bedroom face of the ensuite's right wall; the room is 1.91 m wide to the extension wall (owner)
export const ensuiteRightFaceY = add(ensuiteRightY, partT);

// ── External walls, on the ground floor's walls below ───────────────────────
// The extension's walls stand on the half landings instead (../extension.ts): it is split level.
export const party = wall("wall-party-first", pt(coreW, coreD), pt(mm(0), coreD), { thickness: externalRuns.party.thickness, height: wallH, justification: externalRuns.party.justification });
export const end = externalWall("wall-end-first", externalRuns.end, wallH);
export const endIn = face(end, "north");
export const partyIn = face(party, "south");
export const breastLeftY = add(endIn, breastDepth);
export const bedroomBreastFrontX = mm(7850);

export const frontLeft = wall("wall-front-first-left", externalRuns.front.start, pt(mm(0), bayLeftY), { thickness: frontT, height: wallH, justification: "left" });
export const frontRight = wall("wall-front-first-right", pt(mm(0), bayRightY), externalRuns.front.end, { thickness: frontT, height: wallH, justification: "left" });
export const frontIn = face(frontLeft, "east");

export const rear = externalWall("wall-rear-first", externalRuns.rear, wallH);
export const rearIn = face(rear, "west");
// ── Bay window, front side of the dining room ────────────────────────────────
// Lines are the bay's outer edge; its sides meet the front wall's outer face. Its ceiling is
// 150 mm below the room's, and the lights run up to it, so no wall shows above them.
const bayH = sub(wallH, mm(150));
export const bayLeft = wall("wall-bay-left-first", pt(mm(0), bayLeftY), pt(bayOutX, bayFrontLeftY), { thickness: studT, height: bayH, justification: "centre" });
export const bayFront = wall("wall-bay-front-first", pt(bayOutX, bayFrontLeftY), pt(bayOutX, bayFrontRightY), { thickness: studT, height: bayH, justification: "centre" });
export const bayRight = wall("wall-bay-right-first", pt(bayOutX, bayFrontRightY), pt(mm(0), bayRightY), { thickness: studT, height: bayH, justification: "centre" });

// ── Internal walls ──────────────────────────────────────────────────────────
// Kitchen/dining wall, and the kitchen's rear wall above the step.
export const diningLeft = wall("wall-dining-left-first", pt(frontIn, kitchenRightY), pt(partitionX, kitchenRightY), { thickness: partT, height: wallH, justification: "right" });
export const kitchenRear = wall("wall-kitchen-rear-first", pt(kitchenRearX, kitchenStepY), pt(kitchenRearX, partyIn), { thickness: partT, height: wallH, justification: "right" });
export const kitchenRearLower = wall("wall-kitchen-rear-lower-first", pt(kitchenRearLowerX, diningLeftY), pt(kitchenRearLowerX, kitchenStepY), { thickness: partT, height: wallH, justification: "right" });
export const kitchenStep = wall("wall-kitchen-step-first", pt(kitchenRearLowerX, kitchenStepY), pt(kitchenRearFaceX, kitchenStepY), { thickness: partT, height: wallH, justification: "right" });

// Dining/bedroom partition, on the ground floor's; it runs up to the landing face so the bedroom's
// party wall meets it along its full end.
export const diningBedroom = wall("wall-dining-bedroom-first", pt(partitionX, endIn), pt(partitionX, bedroomLeftFaceY), { thickness: partT, height: wallH, justification: "right" });

// Bedroom left wall, and the ensuite in its rear-left corner.
export const bedroomLeft = wall("wall-bedroom-left-first", pt(partitionRear, bedroomLeftY), pt(ensuiteFrontX, bedroomLeftY), { thickness: partT, height: wallH, justification: "left" });
export const ensuiteFront = wall("wall-ensuite-front-first", pt(ensuiteFrontX, ensuiteRightY), pt(ensuiteFrontX, extRightY), { thickness: partT, height: wallH, justification: "right" });
export const ensuiteRight = wall("wall-ensuite-right-first", pt(ensuiteFrontX, ensuiteRightY), pt(rearIn, ensuiteRightY), { thickness: partT, height: wallH, justification: "left" });
// Under the stairs, level with the extension's right wall, so the whole stair well reads as one wall.
export const ensuiteLeft = wall("wall-ensuite-left-first", pt(ensuiteFrontX, extRightY), pt(coreW, extRightY), { thickness: partT, height: wallH, justification: "left" });

// The stair well and half landing fill one rectangle to the walls' inner faces: the ensuite front
// wall, the extension rear wall, the ensuite left wall and the party wall.
export const stairFrontX = ensuiteFrontX;
export const stairRearX = sub(extRearX, brickT);
export const stairRightY = add(extRightY, brickT);
export const stairLeftY = partyIn;

// The upper flight is one going shorter (17 risers split 9 + 8), so its top riser lands behind the
// well's front edge. The landing sticks out to meet it across the right flight's band, leaving no
// gap to step into.
export const stairArrivalX = mm(6050);

// Chimney breasts on the end wall: the dining-room one stacks on the living room's.
export const breastDining = wall("wall-breast-dining-first", pt(livingBreast.front, endIn), pt(livingBreast.rear, endIn), { thickness: breastDepth, height: wallH, justification: "left" });
export const breastBedroom = wall("wall-breast-bedroom-first", pt(bedroomBreastFrontX, endIn), pt(rearIn, endIn), { thickness: breastDepth, height: wallH, justification: "left" });

export const walls = [
  party,
  end,
  frontLeft,
  frontRight,
  rear,
  bayLeft,
  bayFront,
  bayRight,
  diningLeft,
  kitchenRear,
  kitchenRearLower,
  kitchenStep,
  diningBedroom,
  bedroomLeft,
  ensuiteFront,
  ensuiteRight,
  ensuiteLeft,
  breastDining,
  breastBedroom,
];