/**
 * First-person free-fly mode: pointer lock, movement keys and the frame loop. A toggle keeps the
 * camera's current pose; `?walk=1` starts at the entry pose. Leaving hands the camera back to orbit
 * navigation where it is.
 */
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { WALK_AXES, entryPosition, movementBasis, movementOffset, walkRequested, walkStep } from "../lib/walk.js";
import type { SceneContext } from "./context.js";

export interface WalkMode {
  /** Whether `?walk=1` asks for first-person mode at startup (snapshots never walk). */
  requested(): boolean;
  enter(lock: boolean, keepPose?: boolean): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
  isWalking(): boolean;
}

export function createWalkMode(ctx: SceneContext): WalkMode {
  /** The perspective near plane in first-person mode: OBC's default 1 m would clip walls within arm's reach. */
  const WALK_NEAR = 0.05;
  /** The perspective vertical FOV (degrees) in first-person mode: OBC's 60° reads zoomed-in at close range. */
  const WALK_FOV = 70;
  /** How far ahead of the camera orbit navigation pivots after first-person mode hands back. */
  const EXIT_TARGET_DISTANCE = 10;
  /** True while first-person mode owns the camera; not the same as the store's rendered state. */
  let walkActive = false;
  const walkKeys = new Set<string>();
  let walkRaf = 0;
  let walkLast = 0;
  let everLocked = false;
  let pointerLockControls: PointerLockControls | null = null;
  const walkDirection = new THREE.Vector3();

  /**
   * Enter first-person free-fly mode. A toggle keeps the camera's current position and direction;
   * `?walk=1` passes `keepPose=false` and starts at the entry pose facing plan north. Pauses the
   * camera component and camera-controls input so neither overwrites the free-fly pose. `lock` may
   * only be true inside a user gesture; `?walk=1` instead shows the click-to-look prompt and locks
   * on the first canvas click. Snapshots never walk.
   */
  async function enterWalk(lock: boolean, keepPose = true) {
    if (ctx.snapshot || walkActive) return;
    ctx.hideHover();
    ctx.setMeasuring(false);
    ctx.clearMeasurements();
    walkActive = true;
    const before = ctx.camera.three;
    const position = keepPose ? before.position.clone() : entryPosition(ctx.shownBox(), ctx.lowestElevation());
    const quaternion = keepPose ? before.quaternion.clone() : new THREE.Quaternion(); // identity faces plan north
    await ctx.camera.projection.set("Perspective");
    ctx.camera.enabled = false;
    ctx.camera.controls.enabled = false;
    const camera = ctx.camera.threePersp; // the active camera after the projection switch
    camera.near = WALK_NEAR;
    camera.fov = WALK_FOV;
    camera.updateProjectionMatrix();
    camera.position.copy(position);
    camera.quaternion.copy(quaternion);
    if (!pointerLockControls) {
      // Created lazily, after the first projection switch, so it holds the perspective camera.
      pointerLockControls = new PointerLockControls(camera, ctx.canvas);
      pointerLockControls.addEventListener("lock", () => {
        everLocked = true;
        ctx.store.set({ walkHint: false });
      });
      pointerLockControls.addEventListener("unlock", () => {
        // Escape is the browser's pointer-lock release, so unlocking performs the exit — but only
        // an unlock after a successful lock, so a refused request keeps first-person mode.
        if (everLocked) void exitWalk();
      });
    }
    everLocked = false;
    ctx.store.set({ walking: true, walkHint: true });
    walkLast = performance.now();
    walkRaf = requestAnimationFrame(walkFrame);
    if (lock) pointerLockControls.lock();
    await ctx.fragments.core.update(true);
    ctx.updateCompass();
    ctx.updateLabelOrientation();
  }

  /** Leave first-person mode where the camera is, handing it back to orbit navigation. */
  async function exitWalk() {
    if (!walkActive) return;
    walkActive = false;
    cancelAnimationFrame(walkRaf);
    walkKeys.clear();
    if (pointerLockControls?.isLocked) pointerLockControls.unlock();
    ctx.store.set({ walking: false, walkHint: false, status: `${ctx.currentName()}.ifc` });
    ctx.camera.enabled = true;
    const camera = ctx.camera.three;
    const position = camera.position.clone();
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const target = position.clone().addScaledVector(forward, EXIT_TARGET_DISTANCE);
    await ctx.camera.controls.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, false);
    ctx.camera.controls.enabled = true;
    await ctx.fragments.core.update(true);
    ctx.onWalkExit();
  }

  /** The first-person frame loop: free-fly movement through all geometry. */
  function walkFrame(now: number) {
    if (!walkActive) return;
    const camera = ctx.camera.three;
    const next = walkStep(
      camera.position,
      movementBasis(camera.getWorldDirection(walkDirection)),
      movementOffset(walkKeys),
      (now - walkLast) / 1000,
    );
    const moved = !next.equals(camera.position);
    camera.position.copy(next);
    if (moved) {
      // The controls' "update" event no longer fires while walking, so refresh culling and the
      // compass here.
      void ctx.fragments.core.update();
      ctx.updateCompass();
    }
    // The heading changes as the walker looks around, not only when the position moves.
    ctx.updateLabelOrientation();
    walkLast = now;
    walkRaf = requestAnimationFrame(walkFrame);
  }

  // `?walk=1` (and a refused lock) leave first-person mode without pointer lock: the first canvas
  // click requests it, which is the user gesture the browser requires.
  ctx.canvas.addEventListener("click", () => {
    if (walkActive && pointerLockControls && !pointerLockControls.isLocked) pointerLockControls.lock();
  });
  window.addEventListener("keydown", (e) => {
    if (!walkActive) return;
    if (e.code === "Escape") {
      // Also covers the refused-lock path, where no unlock event will fire.
      void exitWalk();
      return;
    }
    if (e.code in WALK_AXES) {
      walkKeys.add(e.code);
      e.preventDefault(); // the arrows would scroll the page when pointer lock is refused
    }
  });
  window.addEventListener("keyup", (e) => walkKeys.delete(e.code));
  // A focus loss that does not release pointer lock (the pointerlockerror path) must not leave keys
  // held down.
  window.addEventListener("blur", () => walkKeys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) walkKeys.clear();
  });
  document.addEventListener("pointerlockerror", () => {
    if (!walkActive) return;
    ctx.store.set({
      walkHint: true,
      status: "pointer lock refused — click to retry; WASD/arrows fly, Q/E down/up, Esc leaves",
    });
  });

  async function toggle(): Promise<void> {
    if (walkActive) await exitWalk();
    else await enterWalk(true);
  }

  return {
    requested: () => walkRequested(ctx.params, ctx.snapshot),
    enter: enterWalk,
    exit: exitWalk,
    toggle,
    isWalking: () => walkActive,
  };
}
