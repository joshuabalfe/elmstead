/**
 * Elmstead's rear extension walls above the ground floor. The extension is split level: its floors
 * are the stair's half landings, so its walls stand on the half-landing storeys rather than the
 * main floors. The main half landing's walls rise to the attic half landing; the attic half
 * landing's walls rise to the extension roof, which continues the attic's east slope down from the
 * first-floor ceiling where the extension starts (coreW).
 *
 * The ground floor keeps the walls below the main half landing (../ground/walls.ts) until the
 * basement half landing and the rear hall are planned.
 */
import { mm, pt, sub, wall, type Mm, type Wall } from "../../src/model/index.js";
import { atticHalfLanding, atticRidgeHeight, atticRidgeX, coreD, coreW, extEastX, extSouthY, externalRuns, externalWall, firstFloor, mainHalfLanding } from "./shared.js";

const north = externalRuns.north;
const extSouth = externalRuns.extSouth;
const extLength = sub(extEastX, coreW);

/** The main half landing's extension walls, flat-topped up to the attic half landing. */
const mainHeight = sub(atticHalfLanding.elevation, mainHalfLanding.elevation);
export const mainHalfLandingWalls: Wall[] = [
  wall("wall-north-extension-main-half-landing", north.start, pt(coreW, coreD), { thickness: north.thickness, height: mainHeight, justification: north.justification }),
  externalWall("wall-extension-east-main-half-landing", externalRuns.extEast, mainHeight),
  externalWall("wall-extension-south-main-half-landing", extSouth, mainHeight),
];

// The roof at a plan x, as a height above the attic half landing: the first-floor ceiling at coreW,
// falling at the attic gable's pitch towards the extension's east eaves.
const roofPitch = atticRidgeHeight / atticRidgeX; // the attic gable's rise per mm
const ceilingTop = firstFloor.elevation + firstFloor.ceilingHeight;
const roofAt = (x: number): Mm => mm(Math.round(ceilingTop - roofPitch * (x - coreW) - atticHalfLanding.elevation));
const eaves = roofAt(extEastX);

/** The attic half landing's extension walls, tapering with the roof. */
export const atticHalfLandingWalls: Wall[] = [
  wall("wall-north-extension-attic-half-landing", north.start, pt(coreW, coreD), {
    thickness: north.thickness,
    justification: north.justification,
    profile: [{ along: mm(0), up: eaves }, { along: extLength, up: roofAt(coreW) }],
  }),
  externalWall("wall-extension-east-attic-half-landing", externalRuns.extEast, eaves),
  // Run out to the east wall's outer face (not the canonical run's inner-face end) so the taper meets
  // the flat east wall flush at the eaves, as the north extension wall does on its side.
  wall("wall-extension-south-attic-half-landing", extSouth.start, pt(extEastX, extSouthY), {
    thickness: extSouth.thickness,
    justification: extSouth.justification,
    profile: [{ along: mm(0), up: roofAt(coreW) }, { along: extLength, up: eaves }],
  }),
];
