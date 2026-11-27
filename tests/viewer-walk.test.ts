import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  EYE_HEIGHT,
  MAX_FRAME_DELTA,
  WALK_AXES,
  WALK_SPEED,
  entryPosition,
  headingBasis,
  movementOffset,
  stepDistance,
  walkRequested,
  walkStep,
} from "../viewer/walk.js";

const origin = new THREE.Vector3(2, EYE_HEIGHT, 3);
const north = headingBasis(new THREE.Vector3(0, 0, -1)); // looking along plan north, scene −Z

/** Where a single frame of `delta` seconds walks from `origin` with the given keys held. */
function stepped(keys: string[], delta = 0.1, basis = north, from = origin.clone()): THREE.Vector3 {
  return walkStep(from, basis, movementOffset(keys), delta, EYE_HEIGHT);
}

describe("walk helpers", () => {
  it("maps the arrow keys onto the same axes as WASD", () => {
    expect(WALK_AXES.ArrowUp).toEqual(WALK_AXES.KeyW);
    expect(WALK_AXES.ArrowDown).toEqual(WALK_AXES.KeyS);
    expect(WALK_AXES.ArrowLeft).toEqual(WALK_AXES.KeyA);
    expect(WALK_AXES.ArrowRight).toEqual(WALK_AXES.KeyD);
  });

  it("moves forward and back along the heading", () => {
    const d = WALK_SPEED * 0.1;
    expect(stepped(["KeyW"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3 - d));
    expect(stepped(["ArrowUp"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3 - d));
    expect(stepped(["KeyS"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3 + d));
    expect(stepped(["ArrowDown"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3 + d));
  });

  it("strafes right and left across the heading", () => {
    const d = WALK_SPEED * 0.1;
    expect(stepped(["KeyD"])).toEqual(new THREE.Vector3(2 + d, EYE_HEIGHT, 3));
    expect(stepped(["ArrowRight"])).toEqual(new THREE.Vector3(2 + d, EYE_HEIGHT, 3));
    expect(stepped(["KeyA"])).toEqual(new THREE.Vector3(2 - d, EYE_HEIGHT, 3));
    expect(stepped(["ArrowLeft"])).toEqual(new THREE.Vector3(2 - d, EYE_HEIGHT, 3));
  });

  it("follows the heading the camera faces, ignoring pitch", () => {
    // Looking east and 45° down: forward is +X with no vertical component.
    const east = headingBasis(new THREE.Vector3(1, -1, 0).normalize());
    const d = WALK_SPEED * 0.1;
    expect(stepped(["KeyW"], 0.1, east)).toEqual(new THREE.Vector3(2 + d, EYE_HEIGHT, 3));
    // Looking straight down falls back to plan north.
    expect(headingBasis(new THREE.Vector3(0, -1, 0)).forward).toEqual(new THREE.Vector3(0, 0, -1));
  });

  it("normalises diagonals and cancels opposing keys", () => {
    const diagonal = movementOffset(["KeyW", "KeyD"])!;
    expect(diagonal.length()).toBeCloseTo(1);
    const d = WALK_SPEED * 0.1;
    const pos = stepped(["KeyW", "KeyD"]);
    expect(pos.distanceTo(origin.clone().setY(EYE_HEIGHT))).toBeCloseTo(d);
    expect(movementOffset(["KeyW", "KeyS"])!.length()).toBe(0);
    expect(stepped(["KeyW", "KeyS"])).toEqual(new THREE.Vector3(2, EYE_HEIGHT, 3));
  });

  it("ignores keys that are not walk keys", () => {
    expect(movementOffset([])).toBeNull();
    expect(movementOffset(["KeyQ", "ShiftLeft"])).toBeNull();
    expect(movementOffset(["KeyQ", "KeyW"])).toEqual(new THREE.Vector2(1, 0));
  });

  it("clamps the frame delta", () => {
    expect(stepDistance(0.05)).toBeCloseTo(WALK_SPEED * 0.05);
    expect(stepDistance(0.5)).toBeCloseTo(WALK_SPEED * MAX_FRAME_DELTA);
    expect(stepDistance(-1)).toBe(0);
    expect(stepped(["KeyW"], 5)).toEqual(stepped(["KeyW"], MAX_FRAME_DELTA));
  });

  it("keeps the camera at eye height", () => {
    const high = new THREE.Vector3(0, 9, 0);
    expect(walkStep(high, north, movementOffset(["KeyW"]), 0.1, EYE_HEIGHT).y).toBe(EYE_HEIGHT);
    expect(walkStep(high, north, null, 0.1, EYE_HEIGHT)).toEqual(new THREE.Vector3(0, EYE_HEIGHT, 0));
    expect(walkStep(origin, north, movementOffset(["KeyD"]), 0.1, 4.2).y).toBe(4.2);
  });

  it("enters at the footprint centre, 1.6 m above the lowest floor", () => {
    const box = new THREE.Box3(new THREE.Vector3(-4, 0.15, -3), new THREE.Vector3(4, 6, 3));
    // With the building JSON: the lowest storey's elevation (converted to metres) plus eye height.
    expect(entryPosition(box, 0.4)).toEqual(new THREE.Vector3(0, 0.4 + EYE_HEIGHT, 0));
    // Without it: the IFC box's minimum Y plus eye height.
    expect(entryPosition(box, null)).toEqual(new THREE.Vector3(0, 0.15 + EYE_HEIGHT, 0));
  });

  it("suppresses walk mode in snapshots", () => {
    expect(walkRequested(new URLSearchParams("walk=1"), false)).toBe(true);
    expect(walkRequested(new URLSearchParams("snapshot=1&walk=1"), true)).toBe(false);
    expect(walkRequested(new URLSearchParams(""), false)).toBe(false);
    expect(walkRequested(new URLSearchParams("walk=0"), false)).toBe(false);
  });
});
