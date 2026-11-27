/**
 * First-person walk mode: the saved camera, pointer lock, movement keys and frame loop. The engine
 * supplies the camera, the shown extent and the other modes; leaving restores the saved projection,
 * pose and orthographic framing exactly.
 */
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { WALK_AXES, entryPosition, headingBasis, movementOffset, walkRequested, walkStep } from "../lib/walk.js";
import type { SceneContext } from "./context.js";

export interface WalkMode {
  /** Whether `?walk=1` asks for walk mode at startup (snapshots never walk). */
  requested(): boolean;
  enter(lock: boolean): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
  isWalking(): boolean;
}

export function createWalkMode(ctx: SceneContext): WalkMode {
  /** The camera state walk mode saves on entry and restores on exit; non-null while walking. */
  interface SavedView {
    projection: "Orthographic" | "Perspective";
    position: THREE.Vector3;
    target: THREE.Vector3;
    ortho: { left: number; right: number; top: number; bottom: number; zoom: number };
    near: number;
    fov: number;
  }
  /** The perspective near plane while walking: OBC's default 1 m would clip every wall within arm's reach. */
  const WALK_NEAR = 0.05;
  /** The perspective vertical FOV (degrees) while walking: OBC's 60° reads zoomed-in at walking distance. */
  const WALK_FOV = 70;
  let savedView: SavedView | null = null;
  const walkKeys = new Set<string>();
  let walkRaf = 0;
  let walkLast = 0;
  let walkEyeY = 0;
  let everLocked = false;
  let pointerLockControls: PointerLockControls | null = null;
  const walkDirection = new THREE.Vector3();

  /**
   * Enter first-person walk mode: save the camera state, move the perspective camera to the entry
   * pose facing plan north, and pause the camera component and camera-controls input so neither
   * overwrites the walk pose. `lock` may only be true inside a user gesture; `?walk=1` instead shows
   * the click-to-look prompt and locks on the first canvas click. Snapshots never walk.
   */
  async function enterWalk(lock: boolean) {
    if (ctx.snapshot || savedView) return;
    ctx.hideHover();
    ctx.setMeasuring(false);
    ctx.clearMeasurements();
    const controls = ctx.camera.controls;
    const ortho = ctx.camera.threeOrtho;
    savedView = {
      projection: ctx.camera.projection.current,
      position: controls.getPosition(new THREE.Vector3()),
      target: controls.getTarget(new THREE.Vector3()),
      ortho: { left: ortho.left, right: ortho.right, top: ortho.top, bottom: ortho.bottom, zoom: ortho.zoom },
      near: ctx.camera.threePersp.near,
      fov: ctx.camera.threePersp.fov,
    };
    const start = entryPosition(ctx.shownBox(), ctx.lowestElevation());
    walkEyeY = start.y;
    await ctx.camera.projection.set("Perspective");
    ctx.camera.enabled = false;
    controls.enabled = false;
    const camera = ctx.camera.threePersp; // the active camera after the projection switch
    camera.near = WALK_NEAR;
    camera.fov = WALK_FOV;
    camera.updateProjectionMatrix();
    camera.position.copy(start);
    camera.quaternion.identity(); // an identity quaternion faces scene −Z, which is plan north
    if (!pointerLockControls) {
      // Created lazily, after the first projection switch, so it holds the perspective camera.
      pointerLockControls = new PointerLockControls(camera, ctx.canvas);
      pointerLockControls.addEventListener("lock", () => {
        everLocked = true;
        ctx.store.set({ walkHint: false });
      });
      pointerLockControls.addEventListener("unlock", () => {
        // Escape is the browser's pointer-lock release, so unlocking performs the exit — but only
        // an unlock after a successful lock, so a refused request keeps walk mode.
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

  /** Leave walk mode, restoring the saved projection, pose and orthographic framing exactly. */
  async function exitWalk() {
    const restore = savedView;
    if (!restore) return;
    savedView = null;
    cancelAnimationFrame(walkRaf);
    walkKeys.clear();
    if (pointerLockControls?.isLocked) pointerLockControls.unlock();
    ctx.store.set({ walking: false, walkHint: false, status: `${ctx.currentName()}.ifc` });
    ctx.camera.enabled = true;
    ctx.camera.threePersp.near = restore.near;
    ctx.camera.threePersp.fov = restore.fov;
    ctx.camera.threePersp.updateProjectionMatrix();
    await ctx.camera.projection.set(restore.projection);
    if (restore.projection === "Orthographic") {
      // The projection switch recomputes the ortho frustum from the walk pose and resets the zoom;
      // put the saved framing back so a Top view returns exactly as it was. The zoom goes through
      // zoomTo because camera-controls keeps its own zoom state and writes it back to the camera
      // on the next update.
      Object.assign(ctx.camera.threeOrtho, restore.ortho);
      ctx.camera.threeOrtho.updateProjectionMatrix();
      await ctx.camera.controls.zoomTo(restore.ortho.zoom, false);
    }
    const { position: p, target: t } = restore;
    await ctx.camera.controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
    ctx.camera.controls.enabled = true;
    await ctx.fragments.core.update(true);
    ctx.onWalkExit();
  }

  /** The walk frame loop: heading-relative movement at the fixed eye height, through all geometry. */
  function walkFrame(now: number) {
    if (!savedView) return;
    const camera = ctx.camera.three;
    const next = walkStep(
      camera.position,
      headingBasis(camera.getWorldDirection(walkDirection)),
      movementOffset(walkKeys),
      (now - walkLast) / 1000,
      walkEyeY,
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

  // `?walk=1` (and a refused lock) leave walk mode without pointer lock: the first canvas click
  // requests it, which is the user gesture the browser requires.
  ctx.canvas.addEventListener("click", () => {
    if (savedView && pointerLockControls && !pointerLockControls.isLocked) pointerLockControls.lock();
  });
  window.addEventListener("keydown", (e) => {
    if (!savedView) return;
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
    if (!savedView) return;
    ctx.store.set({ walkHint: true, status: "pointer lock refused — click to retry; WASD still moves, Esc leaves" });
  });

  async function toggle(): Promise<void> {
    if (savedView) await exitWalk();
    else await enterWalk(true);
  }

  return {
    requested: () => walkRequested(ctx.params, ctx.snapshot),
    enter: enterWalk,
    exit: exitWalk,
    toggle,
    isWalking: () => savedView !== null,
  };
}
