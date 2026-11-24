/**
 * Basement walls, traced from the owner's basement plan (first pass). The external walls stack on
 * the shared runs; the central partition keeps the ground floor's living/bedroom position. Traced
 * positions are rounded to 25 mm.
 *
 * Left for the eye check: the west wall's stone piers and the south-wall thickening by the shower
 * room (both read as chimney breasts on the drawing). The stair flight in the extension belongs to
 * a later pass; the well is left open here.
 */
import { add, face, mm, pt, wall } from "../../../src/model/index.js";
import { basementFloor, externalRuns, externalWall, partT } from "../shared.js";
import { partitionX } from "../ground/walls.js";

export const wallH = basementFloor.ceilingHeight;

// ── External walls, on the shared runs ───────────────────────────────────────
export const north = externalWall("wall-north-basement", externalRuns.north, wallH);
export const south = externalWall("wall-south-basement", externalRuns.south, wallH);
export const southIn = face(south, "north");
export const northIn = face(north, "south");
export const west = externalWall("wall-west-basement", externalRuns.west, wallH);
export const westIn = face(west, "east");
export const east = externalWall("wall-east-basement", externalRuns.east, wallH);
export const eastIn = face(east, "west");
export const extEast = externalWall("wall-extension-east-basement", externalRuns.extEast, wallH);
export const extSouth = externalWall("wall-extension-south-basement", externalRuns.extSouth, wallH);

// ── Traced plan positions ────────────────────────────────────────────────────
export const hallSouthY = mm(7000); //     hallway south wall, north guest bedroom's north wall
// The small (north, first) guest bedroom is 3100 wide x 2440 deep mm (owner): its east wall line is
// 450 + 3100 + 175 = 3725, and the bedroom divide sits one depth below the hallway south wall's face
// (6825 - 2440 - 175 = 4210). The south bedroom and the shower room keep their traced west wall at
// 3000, so the north bedroom is wider than the south and the corridor steps at the divide.
export const northBedEastX = mm(3725);
// The shower room is 1500 wide x 2500 deep mm (owner): its west wall is the central partition's west
// face (4650) minus 1500 = 3150; its north wall is the south breast's face (600) plus 2500 = 3100.
export const showerWestX = mm(3150); //    south guest bedroom's east wall, the shower room's west wall
export const bedroomDivideY = mm(4210); // wall between the two guest bedrooms
export const showerNorthY = mm(3100); //   shower room's north wall

const inner = { thickness: partT, height: wallH };

// ── Internal walls ───────────────────────────────────────────────────────────
// Central partition, stacking on the ground floor's living/bedroom partition: same face line
// (partitionX) and same body side (east), so the two walls align vertically. The garden room is east.
export const central = wall("wall-central-basement", pt(partitionX, northIn), pt(partitionX, southIn), { ...inner, justification: "left" });
const centralWest = face(central, "west");

// Hallway south wall runs west→east with the body to the south (into the north bedroom). It stops at
// the north bedroom's east wall so the corridor passes the first corner openly, not blocked by it.
export const hallSouth = wall("wall-hall-south-basement", pt(westIn, hallSouthY), pt(northBedEastX, hallSouthY), { ...inner, justification: "right" });
// The corridor's west edge wall runs straight down past both bedrooms to the shower. Bedroom 2 is
// L-shaped: its north-east leg reaches this wall, so its door sits flush with the corridor.
export const northBedEast = wall("wall-north-bed-east-basement", pt(northBedEastX, hallSouthY), pt(northBedEastX, add(showerNorthY, partT)), { ...inner, justification: "right" });
export const bedroomDivide = wall("wall-bedroom-divide-basement", pt(westIn, bedroomDivideY), pt(northBedEastX, bedroomDivideY), { ...inner, justification: "left" });
// The south wall is thickened masonry along its whole length, like the ground floor bedroom's
// breastBedroom: a 350 mm breast on the south wall's inner face, uniform from west wall to east wall.
export const breastSouth = wall("wall-breast-south-basement", pt(westIn, southIn), pt(eastIn, southIn), { thickness: mm(350), height: wallH, justification: "left" });
export const showerWest = wall("wall-shower-west-basement", pt(showerWestX, add(showerNorthY, partT)), pt(showerWestX, face(breastSouth, "north")), { ...inner, justification: "right" });
export const showerNorth = wall("wall-shower-north-basement", pt(showerWestX, showerNorthY), pt(centralWest, showerNorthY), { ...inner, justification: "left" });

export const walls = [north, south, west, east, extEast, extSouth, central, hallSouth, northBedEast, bedroomDivide, showerWest, showerNorth, breastSouth];
