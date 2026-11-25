/**
 * Elmstead: dimensions every floor shares — the building outline, the external walls'
 * thicknesses, and floor levels.
 *
 * Plan origin is the outside south-west corner of the core; x east, y north, mm. "North" is
 * the top of the source drawing, which has no north arrow.
 */
import { add, m, mm, pt, scale, sub, wall, type Mm, type Point, type Wall } from "../../src/model/index.js";

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

// ── External wall runs ───────────────────────────────────────────────────────
/** One external wall's plan geometry, shared by every storey that stacks it. */
export interface WallRun {
  start: Point;
  end: Point;
  thickness: Mm;
  justification: "left" | "right" | "centre";
}

/**
 * The canonical external wall runs, counter-clockwise with the body to the left (inside). Every
 * storey builds its external walls from these with its own height and id; a storey that deviates
 * (the first floor's bay split on the west, the ground floor's east wall stopping at the bathroom)
 * overrides the run rather than re-declaring the outline. Inner-face coordinates are derived from
 * the thicknesses, so they match face() on the built walls exactly.
 */
const northInY = sub(coreD, northT);
const southInY = southT;
const extEastInX = sub(extEastX, brickT);

export const externalRuns = {
  north: { start: pt(extEastX, coreD), end: pt(mm(0), coreD), thickness: northT, justification: "left" },
  south: { start: pt(mm(0), mm(0)), end: pt(coreW, mm(0)), thickness: southT, justification: "left" },
  west: { start: pt(mm(0), northInY), end: pt(mm(0), southInY), thickness: westT, justification: "left" },
  east: { start: pt(coreW, southInY), end: pt(coreW, extSouthY), thickness: eastT, justification: "left" },
  extEast: { start: pt(extEastX, extSouthY), end: pt(extEastX, northInY), thickness: brickT, justification: "left" },
  extSouth: { start: pt(coreW, extSouthY), end: pt(extEastInX, extSouthY), thickness: brickT, justification: "left" },
} satisfies Record<string, WallRun>;

/** Build one storey's external wall from a shared run, at that storey's height. */
export function externalWall(id: string, run: WallRun, height: Mm): Wall {
  return wall(id, run.start, run.end, { thickness: run.thickness, height, justification: run.justification });
}

// ── Levels ───────────────────────────────────────────────────────────────────
/** Ceiling height is from the owner. */
export const groundFloor = { elevation: mm(0), ceilingHeight: m(2.9) };
/** The ground floor slab's thickness. Its top is at the ground elevation, so it hangs down into the basement. */
export const groundSlabT = mm(150);
/**
 * Provisional basement, not measured yet: 2.4 m clear to the underside of the ground slab. The floor
 * sits one slab thickness plus that clear height below ground, and its walls stop at the slab
 * underside. Revisit the elevation when the basement levels are measured.
 */
export const basementClearHeight = m(2.4);
export const basementFloor = {
  elevation: sub(groundFloor.elevation, add(groundSlabT, basementClearHeight)),
  ceilingHeight: basementClearHeight,
};
/**
 * Front steps: the owner asked for four steps to the front door (one more than the first three).
 * The 150 mm riser is assumed — external steps are shallower than the 182.35 mm internal risers —
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
/**
 * Provisional attic floor structure, like the first floor's: joists, deck and finishes. It is the
 * attic slab's thickness, so the slab hangs down onto the first-floor wall tops.
 */
export const atticFloorStructure = mm(200);
/**
 * Attic roof heights. Elmstead is a terrace under a dual-pitch gable roof: the north and south party
 * walls rise to a north-south ridge over the core's mid-span, while the front (west) and back (east)
 * walls stop flat at a low eaves knee wall. The ridge (~3.2 m) and eaves (~0.2 m) are the owner's
 * estimates; the ridge position is still provisional — revisit it when the roof is measured.
 */
export const atticEavesHeight = m(0.2); // owner's estimate
export const atticRidgeHeight = m(3.2); // owner's estimate
export const atticRidgeX = mm(4512); // ridge over the core's east-west mid-span (provisional)
export const atticFloor = {
  elevation: add(add(firstFloor.elevation, firstFloor.ceilingHeight), atticFloorStructure),
  ceilingHeight: atticRidgeHeight,
};
