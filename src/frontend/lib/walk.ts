/**
 * Pure first-person movement maths, in scene metres throughout: the building JSON's millimetre
 * elevations are converted by the caller. No DOM and no scene state, so everything here is
 * unit-testable in node. The scene is Y-up with plan north along −Z (see docs/rendering.md).
 */
import * as THREE from "three";

/** Camera height above the floor when first-person mode starts, in metres. */
export const EYE_HEIGHT = 1.6;
/** Movement speed in metres per second. */
export const WALK_SPEED = 3;
/** Frame deltas beyond this are clamped (tab-out, breakpoints), in seconds. */
export const MAX_FRAME_DELTA = 0.1;

/** KeyboardEvent.code to [forward, right, rise] axis: WASD, the arrow keys, and Q/E. */
export const WALK_AXES: Readonly<Record<string, readonly [number, number, number]>> = {
  KeyW: [1, 0, 0],
  ArrowUp: [1, 0, 0],
  KeyS: [-1, 0, 0],
  ArrowDown: [-1, 0, 0],
  KeyD: [0, 1, 0],
  ArrowRight: [0, 1, 0],
  KeyA: [0, -1, 0],
  ArrowLeft: [0, -1, 0],
  KeyQ: [0, 0, -1],
  KeyE: [0, 0, 1],
};

/** The basis a free-fly step moves along: the full look direction and its horizontal right. */
export interface MovementBasis {
  forward: THREE.Vector3;
  right: THREE.Vector3;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * The movement basis for a look direction: the full look direction for W/S, including pitch, and
 * its horizontal right for A/D. Looking straight up or down falls back to plan north (scene −Z)
 * for the right vector.
 */
export function movementBasis(forward: THREE.Vector3): MovementBasis {
  const direction = forward.clone();
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, -1);
  direction.normalize();
  const flat = new THREE.Vector3(direction.x, 0, direction.z);
  if (flat.lengthSq() < 1e-8) flat.set(0, 0, -1);
  flat.normalize();
  const right = new THREE.Vector3().crossVectors(flat, WORLD_UP).normalize();
  return { forward: direction, right };
}

/**
 * The normalised [x: forward, y: right, z: rise] offset for a set of pressed key codes, or null
 * when no movement key is down. Opposing keys cancel; a diagonal moves at the same speed as a
 * single key.
 */
export function movementOffset(pressedCodes: Iterable<string>): THREE.Vector3 | null {
  const offset = new THREE.Vector3();
  let moving = false;
  for (const code of pressedCodes) {
    const axis = WALK_AXES[code];
    if (!axis) continue;
    moving = true;
    offset.x += axis[0];
    offset.y += axis[1];
    offset.z += axis[2];
  }
  if (!moving) return null;
  if (offset.lengthSq() > 1) offset.normalize();
  return offset;
}

/** How far a frame moves: WALK_SPEED × the delta, clamped to MAX_FRAME_DELTA. */
export function stepDistance(deltaSeconds: number): number {
  return WALK_SPEED * Math.min(Math.max(deltaSeconds, 0), MAX_FRAME_DELTA);
}

/**
 * The next camera position, moved freely: W/S along the full look direction, A/D across it and
 * Q/E up or down in world space. The world-space movement is normalised again because a pitched
 * forward is not orthogonal to world up. No geometry query, so walls and floors are passed through.
 */
export function walkStep(
  position: THREE.Vector3,
  basis: MovementBasis,
  offset: THREE.Vector3 | null,
  deltaSeconds: number,
): THREE.Vector3 {
  const next = position.clone();
  if (offset && offset.lengthSq() > 0) {
    const movement = new THREE.Vector3()
      .addScaledVector(basis.forward, offset.x)
      .addScaledVector(basis.right, offset.y)
      .addScaledVector(WORLD_UP, offset.z);
    if (movement.lengthSq() > 0) next.addScaledVector(movement.normalize(), stepDistance(deltaSeconds));
  }
  return next;
}

/**
 * Where first-person mode starts: the footprint centre at EYE_HEIGHT above the lowest floor,
 * which is `lowestElevationM` (the lowest storey's elevation in metres, converted from the
 * building JSON's millimetres) or, when there is no JSON, the IFC box's minimum Y.
 */
export function entryPosition(box: THREE.Box3, lowestElevationM: number | null): THREE.Vector3 {
  const centre = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(centre.x, (lowestElevationM ?? box.min.y) + EYE_HEIGHT, centre.z);
}

/** Whether the URL asks for first-person mode (`?walk=1`); snapshots never walk. */
export function walkRequested(params: URLSearchParams, snapshot: boolean): boolean {
  return params.get("walk") === "1" && !snapshot;
}
