/**
 * Pure walk-mode maths, in scene metres throughout: the building JSON's millimetre elevations are
 * converted by the caller. No DOM and no scene state, so everything here is unit-testable in node.
 * The scene is Y-up with plan north along −Z (see docs/rendering.md).
 */
import * as THREE from "three";

/** Camera height above the floor, in metres. */
export const EYE_HEIGHT = 1.6;
/** Walking speed in metres per second. */
export const WALK_SPEED = 3;
/** Frame deltas beyond this are clamped (tab-out, breakpoints), in seconds. */
export const MAX_FRAME_DELTA = 0.1;

/** KeyboardEvent.code to [forward, right] axis: WASD and the arrow keys. */
export const WALK_AXES: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
};

/** The horizontal heading a walk step moves along: a unit forward direction and its right. */
export interface HeadingBasis {
  forward: THREE.Vector3;
  right: THREE.Vector3;
}

/**
 * The horizontal basis for a look direction: forward with Y zeroed, falling back to plan north
 * (scene −Z) when looking straight up or down, and right = forward × up.
 */
export function headingBasis(forward: THREE.Vector3): HeadingBasis {
  const flat = new THREE.Vector3(forward.x, 0, forward.z);
  if (flat.lengthSq() < 1e-8) flat.set(0, 0, -1);
  flat.normalize();
  const right = new THREE.Vector3().crossVectors(flat, new THREE.Vector3(0, 1, 0)).normalize();
  return { forward: flat, right };
}

/**
 * The normalised [x: forward, y: right] offset for a set of pressed key codes, or null when no walk
 * key is down. Opposing keys cancel; a diagonal moves at the same speed as a single key.
 */
export function movementOffset(pressedCodes: Iterable<string>): THREE.Vector2 | null {
  const offset = new THREE.Vector2();
  let walking = false;
  for (const code of pressedCodes) {
    const axis = WALK_AXES[code];
    if (!axis) continue;
    walking = true;
    offset.x += axis[0];
    offset.y += axis[1];
  }
  if (!walking) return null;
  if (offset.lengthSq() > 1) offset.normalize();
  return offset;
}

/** How far a frame walks: WALK_SPEED × the delta, clamped to MAX_FRAME_DELTA. */
export function stepDistance(deltaSeconds: number): number {
  return WALK_SPEED * Math.min(Math.max(deltaSeconds, 0), MAX_FRAME_DELTA);
}

/**
 * The next camera position: X/Z moved along the heading basis, Y snapped to `eyeY`. No geometry
 * query, so walls and floors are passed through.
 */
export function walkStep(
  position: THREE.Vector3,
  basis: HeadingBasis,
  offset: THREE.Vector2 | null,
  deltaSeconds: number,
  eyeY: number,
): THREE.Vector3 {
  const next = position.clone();
  if (offset && offset.lengthSq() > 0) {
    const d = stepDistance(deltaSeconds);
    next.addScaledVector(basis.forward, offset.x * d).addScaledVector(basis.right, offset.y * d);
  }
  next.y = eyeY;
  return next;
}

/**
 * Where walk mode starts: the footprint centre at EYE_HEIGHT above the lowest floor, which is
 * `lowestElevationM` (the lowest storey's elevation in metres, converted from the building JSON's
 * millimetres) or, when there is no JSON, the IFC box's minimum Y.
 */
export function entryPosition(box: THREE.Box3, lowestElevationM: number | null): THREE.Vector3 {
  const centre = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(centre.x, (lowestElevationM ?? box.min.y) + EYE_HEIGHT, centre.z);
}

/** Whether the URL asks for walk mode (`?walk=1`); snapshots never walk. */
export function walkRequested(params: URLSearchParams, snapshot: boolean): boolean {
  return params.get("walk") === "1" && !snapshot;
}
