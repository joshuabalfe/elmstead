/**
 * Elmstead: dimensions every floor shares — the building outline, the external walls'
 * thicknesses, and floor levels.
 *
 * Orientation. The plan follows the owner's drawing: x is plan east, y is plan north, in mm, and
 * plan north is the top of the drawing, which has no north arrow. The origin is the outside corner
 * of the core at plan south-west. Ids, names and comments use building sides instead of plan
 * compass words, as seen from the street facing the front wall:
 *
 *   plan west  (−x)  front, onto Picton Rd   faces ≈ 063° (east-north-east)
 *   plan east  (+x)  rear, onto the garden   faces ≈ 243° (west-south-west)
 *   plan north (+y)  left: the party wall    faces ≈ 153° (south-south-east)
 *   plan south (−y)  right: the end wall     faces ≈ 333° (north-north-west)
 *
 * Elmstead is an end terrace. The party wall is on the front-door side and the exposed end wall is
 * on the side with the wrap-around pavement. The true facings follow from site.northAngle (153°,
 * see index.ts). Plan-axis arguments to the src helpers, such as face(wall, "north") or
 * roomCorner("south-west"), still name plan axes, and so do comments marked "plan".
 */
import { add, m, mm, pt, scale, sub, wall, type Mm, type Point, type Wall } from "../../src/model/index.js";

// ── Outline ──────────────────────────────────────────────────────────────────
export const coreW = m(9.025); // living 4.2 m + bedroom 3.85 m (owner) plus the walls between and outside them
export const coreD = m(8.425); // living 5.8 m + hallway 1.5 m (owner) plus the walls between and outside them
export const extRearX = m(10.425); // outside face of the extension's rear wall; keeps its traced 1.4 m width
export const extRightY = m(5.9); // outside face of the extension's right wall; rear hall 2 m deep (owner)

/** Outside of the core plus the rear extension (rear-left corner). */
export const footprint = [pt(mm(0), mm(0)), pt(coreW, mm(0)), pt(coreW, extRightY), pt(extRearX, extRightY), pt(extRearX, coreD), pt(mm(0), coreD)];

// ── Construction ─────────────────────────────────────────────────────────────
export const frontT = mm(450); //  front wall, stone
export const partyT = mm(350); // stone, continues across the extension
export const rearT = mm(350); //  stone
export const endT = mm(250); // stone
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
 * (the first floor's bay split on the front, the ground floor's rear wall stopping at the bathroom)
 * overrides the run rather than re-declaring the outline. Inner-face coordinates are derived from
 * the thicknesses, so they match face() on the built walls exactly.
 */
const partyInY = sub(coreD, partyT);
const endInY = endT;
const extRearInX = sub(extRearX, brickT);

export const externalRuns = {
  party: { start: pt(extRearX, coreD), end: pt(mm(0), coreD), thickness: partyT, justification: "left" },
  end: { start: pt(mm(0), mm(0)), end: pt(coreW, mm(0)), thickness: endT, justification: "left" },
  front: { start: pt(mm(0), partyInY), end: pt(mm(0), endInY), thickness: frontT, justification: "left" },
  rear: { start: pt(coreW, endInY), end: pt(coreW, extRightY), thickness: rearT, justification: "left" },
  extRear: { start: pt(extRearX, extRightY), end: pt(extRearX, partyInY), thickness: brickT, justification: "left" },
  extRight: { start: pt(coreW, extRightY), end: pt(extRearInX, extRightY), thickness: brickT, justification: "left" },
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
 * Provisional basement, not measured yet: 2.4 m clear to the underside of the ground slab. The
 * floor sits one slab thickness plus that clear height below ground, and its walls stop at the slab
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
/** Four front steps, 2000 mm wide, centred on the front door (owner). */
export const frontStepWidth = mm(2000);
export const streetFloor = { elevation: sub(groundFloor.elevation, scale(frontStepRiser, frontStepRisers)) };
/**
 * Front-step railing height, provisional: 900 mm to the top of the rail above the walking
 * surface; update it when the owner measures it. The rail follows the nosing line — base 150 at
 * the first tread, 600 at the threshold — and starts half a 40 mm post (20 mm) up the flight so
 * the bottom post sits wholly on the first tread.
 */
export const frontRailingHeight = mm(900);
/** Railing centreline inset from the flight edge; the 50 mm rail's outer face is 75 mm in. */
export const frontRailingEdgeInset = mm(100);
/** Half a railing post: the bottom-post inset along the flight. */
export const frontRailingEndInset = mm(20);
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
 * Attic roof. Elmstead is an end terrace under a dual-pitch gable roof: the party wall and the
 * exposed end wall are gable ends, rising from the floor to a ridge over the core's mid-span that
 * runs parallel to the street; the rear and extension are open at floor level. The ridge (~3.2 m)
 * is the owner's estimate; the ridge position is still provisional — revisit it when the roof is
 * measured.
 */
export const atticRidgeHeight = m(3.2); // owner's estimate
export const atticRidgeX = mm(4512); // ridge over the core's front-to-back mid-span (provisional)
export const atticFloor = {
  elevation: add(add(firstFloor.elevation, firstFloor.ceilingHeight), atticFloorStructure),
  ceilingHeight: atticRidgeHeight,
};
/**
 * Each half landing is a storey of its own, so walls and openings can stand on it. Its level is the
 * lower flight's share of the stair's risers, so both flights keep (almost) the same riser: the
 * main stair is 9 + 8 risers (owner), the attic stair 8 + 8 (owner). The main landing rounds to the
 * mm, leaving its two flights about 0.05 mm apart per riser.
 */
export const mainStairRisers = { lower: 9, upper: 8 };
export const atticStairRisers = { lower: 8, upper: 8 };
const halfLandingLevel = (bottom: Mm, top: Mm, risers: { lower: number; upper: number }): Mm =>
  add(bottom, mm(Math.round(((top - bottom) * risers.lower) / (risers.lower + risers.upper))));
export const mainHalfLanding = { elevation: halfLandingLevel(groundFloor.elevation, firstFloor.elevation, mainStairRisers) };
export const atticHalfLanding = { elevation: halfLandingLevel(firstFloor.elevation, atticFloor.elevation, atticStairRisers) };
