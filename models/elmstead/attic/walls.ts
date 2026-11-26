/**
 * Attic external walls. Elmstead is a terrace under a dual-pitch gable roof, so the north and south
 * party walls are gable ends rising from the floor to a north-south ridge over the core's mid-span.
 * The front (west) wall is a 700 mm parapet at the front edge; the rear (east) and the extension are
 * open at floor level (the roof runs down to the floor there). The extension's roof is a later pass.
 *
 * Heights and the ridge position are provisional (see ../shared.ts). The internal layout awaits the
 * owner's attic plan.
 */
import { mm, pt, sub, wall } from "../../../src/model/index.js";
import { atticRidgeHeight, atticRidgeX, coreD, coreW, externalRuns, frontT } from "../shared.js";

const ridge = atticRidgeHeight;
const floor = mm(0);

// Top edges in (along, up), running right down to the floor at the eaves. The gables span the core.
const partyProfile = [
  { along: mm(0), up: floor },
  { along: sub(coreW, atticRidgeX), up: ridge },
  { along: coreW, up: floor },
];
const endProfile = [
  { along: mm(0), up: floor },
  { along: atticRidgeX, up: ridge },
  { along: coreW, up: floor },
];

export const party = wall("wall-party-attic", pt(coreW, coreD), pt(mm(0), coreD), { thickness: externalRuns.party.thickness, justification: externalRuns.party.justification, profile: partyProfile });
export const end = wall("wall-end-attic", externalRuns.end.start, externalRuns.end.end, { thickness: externalRuns.end.thickness, justification: externalRuns.end.justification, profile: endProfile });

// The front wall stands 700 mm high (owner) at the front edge, running the full width of the
// building. The rear (east) and extension have no wall: the roof runs down to the floor there.
export const front = wall("wall-front-attic", pt(mm(0), coreD), pt(mm(0), mm(0)), { thickness: frontT, height: mm(700), justification: "left" });

export const walls = [party, end, front];
