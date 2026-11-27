/** The pointer slop below which a press/release counts as a click or tap, in CSS pixels. */
export const CLICK_SLOP_PX = 4;
/** How far a snap candidate may be from the pointer, in CSS pixels. */
export const SNAP_MAX_PX = 12;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface MeasurementValues {
  /** Straight-line distance in millimetres. */
  straightMm: number;
  /** Horizontal plan distance in millimetres. */
  horizontalMm: number;
  /** Absolute height difference in millimetres. */
  verticalMm: number;
}

/** A snap candidate's screen position, kind and scene point. */
export interface SnapCandidate<T> {
  x: number;
  y: number;
  /** True for a corner (point) snap; false for an edge (line) snap. */
  point: boolean;
  at: T;
}

/** The three distances between two scene points; scene coordinates are metres. */
export function measurementValues(from: Point3, to: Point3): MeasurementValues {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return {
    straightMm: Math.hypot(dx, dy, dz) * 1000,
    horizontalMm: Math.hypot(dx, dz) * 1000,
    verticalMm: Math.abs(dy) * 1000,
  };
}

/**
 * The picked second point projected onto the nearest axis line through the first point, so the
 * measurement is axis-aligned instead of diagonal. Ties prefer X, then Z, then Y.
 */
export function axisAlignedPoint(from: Point3, to: Point3): Point3 {
  const ax = Math.abs(to.x - from.x);
  const ay = Math.abs(to.y - from.y);
  const az = Math.abs(to.z - from.z);
  if (ax >= ay && ax >= az) return { x: to.x, y: from.y, z: from.z };
  if (az >= ay) return { x: from.x, y: from.y, z: to.z };
  return { x: from.x, y: to.y, z: from.z };
}

/** The scene label's three lines: total, plan and rise, rounded to whole millimetres. */
export function measurementLines(id: number, values: MeasurementValues): string[] {
  return [
    `M${id} ${Math.round(values.straightMm)} mm`,
    `horizontal ${Math.round(values.horizontalMm)} mm`,
    `vertical ${Math.round(values.verticalMm)} mm`,
  ];
}

/** One row for the measurement list, rounded to whole millimetres. */
export function measurementSummary(id: number, values: MeasurementValues): string {
  return `M${id} ${Math.round(values.straightMm)} mm · plan ${Math.round(values.horizontalMm)} mm · rise ${Math.round(values.verticalMm)} mm`;
}

/**
 * The snap candidate under the pointer: the nearest in screen space, a corner winning an exact
 * tie, and no candidate beyond `maxPx`.
 */
export function nearestSnap<T>(
  candidates: readonly SnapCandidate<T>[],
  pointer: { x: number; y: number },
  maxPx = SNAP_MAX_PX,
): SnapCandidate<T> | undefined {
  let best: SnapCandidate<T> | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - pointer.x, candidate.y - pointer.y);
    if (distance < bestDistance || (distance === bestDistance && candidate.point && !best?.point)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= maxPx ? best : undefined;
}

/** Whether a press and release at these positions is a click/tap rather than a drag. */
export function isMeasureGesture(
  start: { x: number; y: number },
  end: { x: number; y: number },
  maxPx = CLICK_SLOP_PX,
): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= maxPx;
}
