/**
 * Basement walls, traced from the owner's basement plan (first pass). The external walls stack on
 * the shared runs; the central partition keeps the ground floor's living/bedroom position. Traced
 * positions are rounded to 25 mm.
 *
 * Left for the eye check: the front wall's stone piers and the end-wall thickening by the shower
 * room (both read as chimney breasts on the drawing). The stair flight in the extension belongs to
 * a later pass; the well is left open here.
 */
import { add, face, mm, pt, wall } from "../../../src/backend/model/index.js";
import { basementFloor, externalRuns, externalWall, partT } from "../shared.js";
import { partitionX } from "../ground/walls.js";

export const wallH = basementFloor.ceilingHeight;

// ── External walls, on the shared runs ───────────────────────────────────────
export const party = externalWall("wall-party-basement", externalRuns.party, wallH);
export const end = externalWall("wall-end-basement", externalRuns.end, wallH);
export const endIn = face(end, "north");
export const partyIn = face(party, "south");
export const front = externalWall("wall-front-basement", externalRuns.front, wallH);
export const frontIn = face(front, "east");
export const rear = externalWall("wall-rear-basement", externalRuns.rear, wallH);
export const rearIn = face(rear, "west");
export const extRear = externalWall("wall-extension-rear-basement", externalRuns.extRear, wallH);
export const extRight = externalWall("wall-extension-right-basement", externalRuns.extRight, wallH);

// ── Traced plan positions ────────────────────────────────────────────────────
export const hallRightY = mm(7000); //     hallway right wall, left guest bedroom's left wall
// The small (left, first) guest bedroom is 3100 wide x 2440 deep mm (owner): its rear wall line is
// 450 + 3100 + 175 = 3725, and the bedroom divide sits one depth below the hallway right wall's
// face (6825 - 2440 - 175 = 4210). The right bedroom and the shower room keep their traced front
// wall at 3000, so the left bedroom is wider than the right and the corridor steps at the divide.
export const leftBedRearX = mm(3725);
// The shower room is 1500 wide x 2500 deep mm (owner): its front wall is the central partition's
// front face (4650) minus 1500 = 3150; its left wall is the right breast's face (600) plus 2500 =
// 3100.
export const showerFrontX = mm(3150); //    right guest bedroom's rear wall, the shower room's front wall
export const bedroomDivideY = mm(4210); // wall between the two guest bedrooms
export const showerLeftY = mm(3100); //   shower room's left wall

const inner = { thickness: partT, height: wallH };

// ── Internal walls ───────────────────────────────────────────────────────────
// Central partition, stacking on the ground floor's living/bedroom partition: same face line
// (partitionX) and same body side (towards the rear), so the two walls align vertically. The garden
// room is behind it.
export const central = wall("wall-central-basement", pt(partitionX, partyIn), pt(partitionX, endIn), {
  ...inner,
  justification: "left",
});
const centralFront = face(central, "west");

// Hallway right wall runs plan west→east with the body on its right (into the left bedroom). It
// stops at the left bedroom's rear wall so the corridor passes the first corner openly, not blocked
// by it.
export const hallRight = wall("wall-hall-right-basement", pt(frontIn, hallRightY), pt(leftBedRearX, hallRightY), {
  ...inner,
  justification: "right",
});
// The corridor's front edge wall runs straight down past both bedrooms to the shower. Bedroom 2 is
// L-shaped: its rear-left leg reaches this wall, so its door sits flush with the corridor.
export const leftBedRear = wall(
  "wall-left-bed-rear-basement",
  pt(leftBedRearX, hallRightY),
  pt(leftBedRearX, add(showerLeftY, partT)),
  { ...inner, justification: "right" },
);
export const bedroomDivide = wall(
  "wall-bedroom-divide-basement",
  pt(frontIn, bedroomDivideY),
  pt(leftBedRearX, bedroomDivideY),
  { ...inner, justification: "left" },
);
// The end wall is thickened masonry along its whole length, like the ground floor bedroom's
// breastBedroom: a 350 mm breast on the end wall's inner face, uniform from front wall to rear
// wall.
export const breastRight = wall("wall-breast-right-basement", pt(frontIn, endIn), pt(rearIn, endIn), {
  thickness: mm(350),
  height: wallH,
  justification: "left",
});
export const showerFront = wall(
  "wall-shower-front-basement",
  pt(showerFrontX, add(showerLeftY, partT)),
  pt(showerFrontX, face(breastRight, "north")),
  { ...inner, justification: "right" },
);
export const showerLeft = wall(
  "wall-shower-left-basement",
  pt(showerFrontX, showerLeftY),
  pt(centralFront, showerLeftY),
  { ...inner, justification: "left" },
);

export const walls = [
  party,
  end,
  front,
  rear,
  extRear,
  extRight,
  central,
  hallRight,
  leftBedRear,
  bedroomDivide,
  showerFront,
  showerLeft,
  breastRight,
];
