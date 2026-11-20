/**
 * Ground-floor walls, and the plan positions they are built from. Openings and rooms derive from
 * these, so this is the file to edit to move a wall.
 *
 * Measured from the owner's plan image at 8 m = 1689 px (about 4.74 mm per px), rounded to 25 mm.
 * The living room and hallway sizes are the owner's measurements, not traced.
 */
import { face, mm, pt, sub, wall } from "../../../src/model/index.js";
import { brickT, coreD, coreW, eastT, extEastX, extSouthY, groundFloor, northT, partT, southT, studT, westT } from "../shared.js";

export const wallH = groundFloor.ceilingHeight; // walls stop at the ceiling until there is an upper floor
const breastT = mm(350); // chimney breast / thickened wall projecting from the south wall

// ── Internal layout (plan faces) ─────────────────────────────────────────────
export const partitionX = mm(4650); //  west face of the living/bedroom partition; living room 4.2 m wide (owner)
export const hallWallY = mm(6400); //   south face of the hall/living wall; living room 5.8 m deep from the breast (owner)
export const bedroomWallY = mm(3900); // south face of the bedroom/bathroom wall; bedroom 3.3 m deep from the breast (owner)
export const bathWestX = mm(5690); //   west face of the lobby/bathroom wall; lobby 0.865 m wide (owner)
export const bathNorthY = mm(5675); //  south face of the bathroom's north wall; bathroom 1.6 m deep (owner)
export const spineY = mm(6900); //      south face of the wall between the stair flights; keeps its traced offset from the hall wall
export const spineEastX = mm(8945); // keeps its traced overlap into the east wall
export const livingBreast = { west: mm(1050), east: mm(3425) };

// ── External walls (counter-clockwise, body on the left = inside) ────────────
export const north = wall("wall-north", pt(extEastX, coreD), pt(mm(0), coreD), { thickness: northT, height: wallH, justification: "left" });
export const south = wall("wall-south", pt(mm(0), mm(0)), pt(coreW, mm(0)), { thickness: southT, height: wallH, justification: "left" });
export const southIn = face(south, "north");
export const northIn = face(north, "south");
export const west = wall("wall-west", pt(mm(0), northIn), pt(mm(0), southIn), { thickness: westT, height: wallH, justification: "left" });
export const westIn = face(west, "east");

// Bathroom north wall first: the core's east wall stops at its north face, where the extension opens off.
export const bathNorth = wall("wall-bathroom-north", pt(sub(coreW, eastT), bathNorthY), pt(bathWestX, bathNorthY), { thickness: studT, height: wallH, justification: "right" });
export const east = wall("wall-east", pt(coreW, southIn), pt(coreW, face(bathNorth, "north")), { thickness: eastT, height: wallH, justification: "left" });
export const eastIn = face(east, "west");

export const extEast = wall("wall-extension-east", pt(extEastX, extSouthY), pt(extEastX, northIn), { thickness: brickT, height: wallH, justification: "left" });
export const extSouth = wall("wall-extension-south", pt(coreW, extSouthY), pt(face(extEast, "west"), extSouthY), { thickness: brickT, height: wallH, justification: "left" });

// Chimney breast in the living room and the thickened wall along the bedroom, both against the south wall.
export const breastLiving = wall("wall-breast-living", pt(livingBreast.west, southIn), pt(livingBreast.east, southIn), { thickness: breastT, height: wallH, justification: "left" });

// ── Internal walls ───────────────────────────────────────────────────────────
const inner = { thickness: partT, height: wallH };
const lobbyBathT = mm(135); // owner widths: bedroom 3.85 − lobby 0.865 − bathroom 2.85
export const livingBedroom = wall("wall-living-bedroom", pt(partitionX, southIn), pt(partitionX, hallWallY), { ...inner, justification: "right" });
export const partitionEast = face(livingBedroom, "east");
// Runs over the partition's top so the corner is closed.
export const hallLiving = wall("wall-hall-living", pt(westIn, hallWallY), pt(partitionEast, hallWallY), { ...inner, justification: "left" });
export const breastBedroom = wall("wall-breast-bedroom", pt(partitionEast, southIn), pt(eastIn, southIn), { thickness: breastT, height: wallH, justification: "left" });
export const bedroomBathroom = wall("wall-bedroom-bathroom", pt(partitionEast, bedroomWallY), pt(eastIn, bedroomWallY), { ...inner, justification: "left" });
export const lobbyBathroom = wall("wall-lobby-bathroom", pt(bathWestX, face(bedroomBathroom, "north")), pt(bathWestX, face(bathNorth, "north")), { thickness: lobbyBathT, height: wallH, justification: "right" });
export const spine = wall("wall-stair-spine", pt(mm(5275), spineY), pt(spineEastX, spineY), { ...inner, justification: "left" });
// Diagonal screen from the hall wall's corner to the end of the stair spine, holding the lobby door.
export const lobbyScreen = wall("wall-lobby-screen", pt(partitionEast, face(hallLiving, "north")), spine.start, { thickness: studT, height: wallH, justification: "centre" });

export const walls = [north, south, west, east, extEast, extSouth, breastLiving, breastBedroom, hallLiving, livingBedroom, bedroomBathroom, lobbyBathroom, bathNorth, spine, lobbyScreen];
