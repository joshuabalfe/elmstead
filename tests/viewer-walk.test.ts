import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  EYE_HEIGHT,
  MAX_FRAME_DELTA,
  WALK_AXES,
  WALK_SPEED,
  entryPosition,
  movementBasis,
  movementOffset,
  stepDistance,
  walkRequested,
  walkStep,
} from "../src/frontend/lib/walk.js";

const origin = new THREE.Vector3(2, EYE_HEIGHT, 3);
const north = movementBasis(new THREE.Vector3(0, 0, -1)); // looking along plan north, scene −Z

/** Where a single frame of `delta` seconds moves from `origin` with the given keys held. */
function stepped(keys: string[], delta = 0.1, basis = north, from = origin.clone()): THREE.Vector3 {
  return walkStep(from, basis, movementOffset(keys), delta);
}

describe("walk helpers", () => {
  it("maps the arrow keys onto the same axes as WASD", () => {
    expect(WALK_AXES.ArrowUp).toEqual(WALK_AXES.KeyW);
    expect(WALK_AXES.ArrowDown).toEqual(WALK_AXES.KeyS);
    expect(WALK_AXES.ArrowLeft).toEqual(WALK_AXES.KeyA);
    expect(WALK_AXES.ArrowRight).toEqual(WALK_AXES.KeyD);
  });

  it("adds Q/E as world down and up", () => {
    expect(WALK_AXES.KeyQ).toEqual([0, 0, -1]);
    expect(WALK_AXES.KeyE).toEqual([0, 0, 1]);
  });

  it("moves forward and back along the look direction", () => {
    const d = WALK_SPEED * 0.1;
    expect(stepped(["KeyW"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3 - d));
    expect(stepped(["ArrowUp"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3 - d));
    expect(stepped(["KeyS"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3 + d));
    expect(stepped(["ArrowDown"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3 + d));
  });

  it("strafes right and left across the look direction", () => {
    const d = WALK_SPEED * 0.1;
    expect(stepped(["KeyD"])).toEqual(new THREE.Vector3(2 + d, EYE_HEIGHT, 3));
    expect(stepped(["ArrowRight"])).toEqual(new THREE.Vector3(2 + d, EYE_HEIGHT, 3));
    expect(stepped(["KeyA"])).toEqual(new THREE.Vector3(2 - d, EYE_HEIGHT, 3));
    expect(stepped(["ArrowLeft"])).toEqual(new THREE.Vector3(2 - d, EYE_HEIGHT, 3));
  });

  it("follows the full look direction, including pitch", () => {
    const d = WALK_SPEED * 0.1;
    // Looking east and 45° down: forward is +X and −Y.
    const downEast = movementBasis(new THREE.Vector3(1, -1, 0).normalize());
    const moved = stepped(["KeyW"], 0.1, downEast);
    expect(moved.x).toBeCloseTo(2 + d / Math.SQRT2);
    expect(moved.y).toBeCloseTo(EYE_HEIGHT - d / Math.SQRT2);
    expect(moved.z).toBeCloseTo(3);

    // Looking straight down moves straight down, with a stable horizontal right.
    const straightDown = movementBasis(new THREE.Vector3(0, -1, 0));
    expect(straightDown.forward).toEqual(new THREE.Vector3(0, -1, 0));
    expect(straightDown.right.x).toBe(1);
    expect(straightDown.right.y).toBeCloseTo(0);
    expect(straightDown.right.z).toBeCloseTo(0);
    expect(stepped(["KeyW"], 0.1, straightDown)).toEqual(new THREE.Vector3(2, EYE_HEIGHT - d, 3));
  });

  it("moves down and up with Q/E in world space", () => {
    const d = WALK_SPEED * 0.1;
    const high = new THREE.Vector3(2, 9, 3);
    expect(stepped(["KeyE"], 0.1, north, high)).toEqual(new THREE.Vector3(2, 9 + d, 3));
    expect(stepped(["KeyQ"], 0.1, north, high)).toEqual(new THREE.Vector3(2, 9 - d, 3));

    // Vertical movement stays world up even when the camera is pitched.
    const downEast = movementBasis(new THREE.Vector3(1, -1, 0).normalize());
    expect(stepped(["KeyE"], 0.1, downEast, high)).toEqual(new THREE.Vector3(2, 9 + d, 3));
  });

  it("normalises diagonals and cancels opposing keys", () => {
    const diagonal = movementOffset(["KeyW", "KeyD"])!;
    expect(diagonal.length()).toBeCloseTo(1);
    const d = WALK_SPEED * 0.1;
    expect(stepped(["KeyW", "KeyD"]).distanceTo(origin.clone())).toBeCloseTo(d);
    expect(movementOffset(["KeyW", "KeyS"])!.length()).toBe(0);
    expect(stepped(["KeyW", "KeyS"])).toEqual(origin);

    // A pitched look plus a rise still moves at the same speed.
    const straightUp = movementBasis(new THREE.Vector3(0, 1, 0));
    expect(stepped(["KeyW", "KeyE"], 0.1, straightUp).distanceTo(origin.clone())).toBeCloseTo(d);
  });

  it("ignores keys that are not movement keys", () => {
    expect(movementOffset([])).toBeNull();
    expect(movementOffset(["KeyZ", "ShiftLeft"])).toBeNull();
    expect(movementOffset(["KeyZ", "KeyW"])).toEqual(new THREE.Vector3(1, 0, 0));
  });

  it("clamps the frame delta", () => {
    expect(stepDistance(0.05)).toBeCloseTo(WALK_SPEED * 0.05);
    expect(stepDistance(0.5)).toBeCloseTo(WALK_SPEED * MAX_FRAME_DELTA);
    expect(stepDistance(-1)).toBe(0);
    expect(stepped(["KeyW"], 5)).toEqual(stepped(["KeyW"], MAX_FRAME_DELTA));
  });

  it("leaves the height alone when there is no vertical input", () => {
    const high = new THREE.Vector3(0, 9, 0);
    expect(walkStep(high, north, movementOffset(["KeyW"]), 0.1).y).toBe(9);
    expect(walkStep(high, north, null, 0.1)).toEqual(high);
  });

  it("enters at the footprint centre, 1.6 m above the lowest floor", () => {
    const box = new THREE.Box3(new THREE.Vector3(-4, 0.15, -3), new THREE.Vector3(4, 6, 3));
    // With the building JSON: the lowest storey's elevation (converted to metres) plus eye height.
    expect(entryPosition(box, 0.4)).toEqual(new THREE.Vector3(0, 0.4 + EYE_HEIGHT, 0));
    // Without it: the IFC box's minimum Y plus eye height.
    expect(entryPosition(box, null)).toEqual(new THREE.Vector3(0, 0.15 + EYE_HEIGHT, 0));
  });

  it("suppresses first-person mode in snapshots", () => {
    expect(walkRequested(new URLSearchParams("walk=1"), false)).toBe(true);
    expect(walkRequested(new URLSearchParams("snapshot=1&walk=1"), true)).toBe(false);
    expect(walkRequested(new URLSearchParams(""), false)).toBe(false);
    expect(walkRequested(new URLSearchParams("walk=0"), false)).toBe(false);
  });
});
