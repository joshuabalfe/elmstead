/**
 * Elmstead: dimensions every floor shares — the building outline, the external walls'
 * thicknesses, and floor levels.
 *
 * Plan origin is the outside south-west corner of the core; x east, y north, mm. "North" is
 * the top of the source drawing, which has no north arrow.
 */
import { add, m, mm, pt, scale, sub } from "../../src/model/index.js";

// ── Outline ──────────────────────────────────────────────────────────────────
export const coreW = m(9.025); // living 4.2 m + bedroom 3.85 m (owner) plus the walls between and outside them
export const coreD = m(8.425); // living 5.8 m + hallway 1.5 m (owner) plus the walls between and outside them
export const extEastX = m(10.425); // outside face of the extension's east wall; keeps its traced 1.4 m width
export const extSouthY = m(5.9); // outside face of the extension's south wall; rear hall 2 m deep (owner)

/** Outside of the core plus the rear extension (north-east corner). */
export const footprint = [pt(mm(0), mm(0)), pt(coreW, mm(0)), pt(coreW, extSouthY), pt(extEastX, extSouthY), pt(extEastX, coreD), pt(mm(0), coreD)];

// ── Construction ─────────────────────────────────────────────────────────────
export const westT = mm(450); //  front wall, stone
export const northT = mm(350); // stone, continues across the extension
export const eastT = mm(350); //  stone
export const southT = mm(250); // stone
export const brickT = mm(175); // extension walls
export const partT = mm(175); //  internal partitions
export const studT = mm(100); //  light partitions

// ── Levels ───────────────────────────────────────────────────────────────────
/** Ceiling height is from the owner. */
export const groundFloor = { elevation: mm(0), ceilingHeight: m(2.9) };
/**
 * Front steps: the owner asked for four steps to the front door (one more than the first three).
 * The 150 mm riser is assumed — external steps are shallower than the 190.6 mm internal risers —
 * giving a provisional 600 mm drop to the street; update it when the threshold-to-path drop is
 * measured.
 */
export const frontStepRisers = 4;
export const frontStepRiser = mm(150);
export const frontStepGoing = mm(300);
export const streetFloor = { elevation: sub(groundFloor.elevation, scale(frontStepRiser, frontStepRisers)) };
/**
 * Provisional floor structure between the ground ceiling and the first floor: joists, deck and
 * finishes. It is also the first-floor slab's thickness, so changing it moves the first floor and
 * the stair rise with it.
 */
export const firstFloorStructure = mm(200);
/**
 * The first-floor ceiling height is from the owner: 2.7 m, 200 mm lower than the ground floor's.
 * Its elevation is not measured yet, so it still sits one structure thickness above the ground
 * ceiling; revisit that when the levels are measured.
 */
export const firstFloor = { elevation: add(groundFloor.ceilingHeight, firstFloorStructure), ceilingHeight: m(2.7) };
