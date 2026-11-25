/**
 * Attic external walls. Elmstead is a terrace under a dual-pitch gable roof, so the north and south
 * party walls are gable ends rising to a north-south ridge over the core's mid-span; the front (west)
 * and back (east) walls stop flat at eaves height, the roof sloping down to them. The north wall also
 * carries the rear extension, whose roof stays flat at eaves height for now (a later pass).
 *
 * Heights and the ridge position are provisional (see ../shared.ts). The internal layout awaits the
 * owner's attic plan.
 */
import { mm, pt, sub, wall } from "../../../src/model/index.js";
import { atticEavesHeight, atticRidgeHeight, atticRidgeX, coreD, coreW, extEastX, externalRuns, externalWall, westT } from "../shared.js";

const eaves = atticEavesHeight;
const ridge = atticRidgeHeight;

// Top edges in (along, up). The north wall runs east→west from the extension's east end, so its
// extension band (along 0 → extEastX-coreW) stays at eaves before the core gable rises to the ridge.
const northProfile = [
  { along: mm(0), up: eaves },
  { along: sub(extEastX, coreW), up: eaves },
  { along: sub(extEastX, atticRidgeX), up: ridge },
  { along: extEastX, up: eaves },
];
const southProfile = [
  { along: mm(0), up: eaves },
  { along: atticRidgeX, up: ridge },
  { along: coreW, up: eaves },
];

export const north = wall("wall-north-attic", externalRuns.north.start, externalRuns.north.end, { thickness: externalRuns.north.thickness, justification: externalRuns.north.justification, profile: northProfile });
export const south = wall("wall-south-attic", externalRuns.south.start, externalRuns.south.end, { thickness: externalRuns.south.thickness, justification: externalRuns.south.justification, profile: southProfile });

// Eaves walls: back and extension stop flat at eaves height. The front wall stands 700 mm high
// (owner) at the front edge, running the full width of the building; the gable party walls keep their
// own eaves-to-ridge height.
export const west = wall("wall-west-attic", pt(mm(0), coreD), pt(mm(0), mm(0)), { thickness: westT, height: mm(700), justification: "left" });
export const east = externalWall("wall-east-attic", externalRuns.east, eaves);
export const extEast = externalWall("wall-extension-east-attic", externalRuns.extEast, eaves);
export const extSouth = externalWall("wall-extension-south-attic", externalRuns.extSouth, eaves);

export const walls = [north, south, west, east, extEast, extSouth];
