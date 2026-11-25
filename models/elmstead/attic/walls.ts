/**
 * Attic external walls, stacking on the first floor's via the shared runs. The internal layout awaits
 * the owner's attic plan, so only the envelope is here for now. The west wall is the straight run;
 * whether the attic carries the dining-room bay is a question for the plan.
 */
import { atticFloor, externalRuns, externalWall } from "../shared.js";

export const wallH = atticFloor.ceilingHeight;

export const north = externalWall("wall-north-attic", externalRuns.north, wallH);
export const south = externalWall("wall-south-attic", externalRuns.south, wallH);
export const west = externalWall("wall-west-attic", externalRuns.west, wallH);
export const east = externalWall("wall-east-attic", externalRuns.east, wallH);
export const extEast = externalWall("wall-extension-east-attic", externalRuns.extEast, wallH);
export const extSouth = externalWall("wall-extension-south-attic", externalRuns.extSouth, wallH);

export const walls = [north, south, west, east, extEast, extSouth];
