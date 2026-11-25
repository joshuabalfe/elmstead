/**
 * Attic external walls. Elmstead is a terrace under a dual-pitch gable roof, so the north and south
 * party walls are gable ends rising from the floor to a north-south ridge over the core's mid-span.
 * The front (west) wall is a 700 mm parapet at the front edge; the back (east) and extension walls
 * stop flat at a low eaves knee wall. The north wall also carries the rear extension, whose roof
 * stays at floor level for now (a later pass).
 *
 * Heights and the ridge position are provisional (see ../shared.ts). The internal layout awaits the
 * owner's attic plan.
 */
import { mm, pt, sub, wall } from "../../../src/model/index.js";
import { atticEavesHeight, atticRidgeHeight, atticRidgeX, coreD, coreW, extEastX, externalRuns, externalWall, westT } from "../shared.js";

const eaves = atticEavesHeight;
const ridge = atticRidgeHeight;
const floor = mm(0);

// Top edges in (along, up), running right down to the floor at the eaves. The gables span the core;
// the rear extension's north wall is a separate flat eaves wall (its roof is a later pass), so each
// wall's body matches its plan footprint.
const northProfile = [
  { along: mm(0), up: floor },
  { along: sub(coreW, atticRidgeX), up: ridge },
  { along: coreW, up: floor },
];
const southProfile = [
  { along: mm(0), up: floor },
  { along: atticRidgeX, up: ridge },
  { along: coreW, up: floor },
];

export const north = wall("wall-north-attic", pt(coreW, coreD), pt(mm(0), coreD), { thickness: externalRuns.north.thickness, justification: externalRuns.north.justification, profile: northProfile });
export const northExt = wall("wall-north-extension-attic", pt(extEastX, coreD), pt(coreW, coreD), { thickness: externalRuns.north.thickness, justification: externalRuns.north.justification, height: eaves });
export const south = wall("wall-south-attic", externalRuns.south.start, externalRuns.south.end, { thickness: externalRuns.south.thickness, justification: externalRuns.south.justification, profile: southProfile });

// The front wall stands 700 mm high (owner) at the front edge, running the full width of the
// building. The back and extension walls stop flat at the low eaves knee wall.
export const west = wall("wall-west-attic", pt(mm(0), coreD), pt(mm(0), mm(0)), { thickness: westT, height: mm(700), justification: "left" });
export const east = externalWall("wall-east-attic", externalRuns.east, eaves);
export const extEast = externalWall("wall-extension-east-attic", externalRuns.extEast, eaves);
export const extSouth = externalWall("wall-extension-south-attic", externalRuns.extSouth, eaves);

export const walls = [north, northExt, south, west, east, extEast, extSouth];
