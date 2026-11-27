/**
 * Elmstead's rear extension walls above the ground floor. The extension is split level: its floors
 * are the stair's half landings, so its walls stand on the half-landing storeys rather than the
 * main floors. The main half landing's walls rise to the attic half landing; the attic half
 * landing's walls rise to the extension roof, which continues the attic's rear slope down from the
 * first-floor ceiling where the extension starts (coreW).
 *
 * The ground floor keeps the walls below the main half landing (../ground/walls.ts) until the
 * basement half landing and the rear hall are planned.
 */
import { mm, pt, sub, wall, type Mm, type Wall } from "../../src/backend/model/index.js";
import {
  atticHalfLanding,
  atticRidgeHeight,
  atticRidgeX,
  coreD,
  coreW,
  extRearX,
  extRightY,
  externalRuns,
  externalWall,
  firstFloor,
  mainHalfLanding,
} from "./shared.js";

const party = externalRuns.party;
const extRight = externalRuns.extRight;
const extLength = sub(extRearX, coreW);

/** The main half landing's extension walls, flat-topped up to the attic half landing. */
const mainHeight = sub(atticHalfLanding.elevation, mainHalfLanding.elevation);
export const mainHalfLandingRear = externalWall(
  "wall-extension-rear-main-half-landing",
  externalRuns.extRear,
  mainHeight,
);
export const mainHalfLandingWalls: Wall[] = [
  wall("wall-party-extension-main-half-landing", party.start, pt(coreW, coreD), {
    thickness: party.thickness,
    height: mainHeight,
    justification: party.justification,
  }),
  mainHalfLandingRear,
  externalWall("wall-extension-right-main-half-landing", extRight, mainHeight),
];

// The roof at a plan x, as a height above the attic half landing: the first-floor ceiling at coreW,
// falling at the attic gable's pitch towards the extension's rear eaves.
const roofPitch = atticRidgeHeight / atticRidgeX; // the attic gable's rise per mm
const ceilingTop = firstFloor.elevation + firstFloor.ceilingHeight;
const roofAt = (x: number): Mm => mm(Math.round(ceilingTop - roofPitch * (x - coreW) - atticHalfLanding.elevation));
const eaves = roofAt(extRearX);

/** The attic half landing's extension walls, tapering with the roof. */
export const atticHalfLandingWalls: Wall[] = [
  wall("wall-party-extension-attic-half-landing", party.start, pt(coreW, coreD), {
    thickness: party.thickness,
    justification: party.justification,
    profile: [
      { along: mm(0), up: eaves },
      { along: extLength, up: roofAt(coreW) },
    ],
  }),
  externalWall("wall-extension-rear-attic-half-landing", externalRuns.extRear, eaves),
  // Run out to the rear wall's outer face (not the canonical run's inner-face end) so the taper
  // meets the flat rear wall flush at the eaves, as the party wall across the extension does on its
  // side.
  wall("wall-extension-right-attic-half-landing", extRight.start, pt(extRearX, extRightY), {
    thickness: extRight.thickness,
    justification: extRight.justification,
    profile: [
      { along: mm(0), up: roofAt(coreW) },
      { along: extLength, up: eaves },
    ],
  }),
];
