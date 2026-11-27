/**
 * Hover identification: the model id and name of the element under the pointer, in the constraint
 * label's style above everything. It owns the label map, the hover sprite and the single-flight
 * pick queue; the engine only toggles it and resets it per load.
 */
import type { FragmentsModel } from "@thatopen/fragments";
import * as THREE from "three";
import { C } from "../../shared/render/style.js";
import { billboard } from "./billboard.js";
import type { SceneContext } from "./context.js";
import { disposeTree } from "./dispose.js";
import { elementLabel, type ElementLabel } from "./element-label.js";

export interface Identify {
  /** Whether `?ids=1` asks for identification at startup (snapshots never identify). */
  requested(): boolean;
  setIdentifying(on: boolean): void;
  isIdentifying(): boolean;
  /** Re-pick the stationary pointer's position after a load, storey choice or walk exit. */
  repick(): void;
  hide(): void;
  /** A new load: bump the epoch, hide the label and forget the previous model's item ids. */
  reset(): void;
  /** Record each item's model id and name, for the model just loaded. */
  labelsFor(model: FragmentsModel): Promise<void>;
}

export function createIdentify(ctx: SceneContext): Identify {
  let hoverSprite: THREE.Sprite | null = null;
  let identifying = false;
  /** Model id and name per fragments item, rebuilt on every load; Tags exist even without model JSON. */
  const elementLabels = new Map<number, ElementLabel>();
  let hoverQueued: { x: number; y: number } | null = null;
  let hoverPicking = false;
  let hoverEpoch = 0;
  let lastPointer: { x: number; y: number } | null = null;
  window.__elmsteadHover = null;

  /** A load, storey choice or walk exit can finish under a stationary cursor; re-pick its position. */
  function repickHover() {
    if (identifying && !ctx.snapshot && !ctx.isWalking() && lastPointer) {
      hoverQueued = { ...lastPointer };
      void runHoverPicks();
    }
  }

  function disposeHoverSprite() {
    if (!hoverSprite) return;
    ctx.scene.remove(hoverSprite);
    disposeTree(hoverSprite);
    hoverSprite = null;
  }

  function hideHover() {
    disposeHoverSprite();
    window.__elmsteadHover = null;
  }

  function setIdentifying(on: boolean) {
    identifying = on;
    ctx.store.set({ ids: on });
    if (!on) hideHover();
  }

  /** Resolve hover picks one at a time; a move during a pick waits for it, like the measure queue. */
  async function runHoverPicks() {
    if (hoverPicking) return;
    hoverPicking = true;
    try {
      while (hoverQueued) {
        const next = hoverQueued;
        hoverQueued = null;
        const epoch = hoverEpoch;
        const model = ctx.currentModel();
        if (!identifying || ctx.snapshot || ctx.isWalking() || !model) continue;
        const ray = { camera: ctx.camera.three, mouse: new THREE.Vector2(next.x, next.y), dom: ctx.canvas };
        const ghost = ctx.ghostModel();
        // In Diff mode the removed elements' ghosts are picked too, and the nearer hit wins.
        const [own, removed] = await Promise.all([
          model.raycast(ray),
          ghost ? ghost.raycast(ray) : Promise.resolve(null),
        ]);
        if (epoch !== hoverEpoch || ctx.currentModel() !== model || !identifying || ctx.isWalking()) continue;
        const ghostHit =
          removed && ctx.ghostLabel(removed.localId) !== undefined && (!own || removed.distance < own.distance);
        const hit = ghostHit ? removed : own;
        const label = hit ? (ghostHit ? ctx.ghostLabel(hit.localId) : elementLabels.get(hit.localId)) : undefined;
        if (!hit || !label) {
          hideHover();
          continue;
        }
        const diffStatus = ghostHit ? "removed" : ctx.diffStatusOf(label.id);
        window.__elmsteadHover = { id: label.id, name: label.name, ...(diffStatus ? { status: diffStatus } : {}) };
        // Constraint-label styling, but depth-untested like the measurement readout: on top of everything.
        const key = `${label.id}${diffStatus ?? ""}`;
        if (!hoverSprite || hoverSprite.userData.id !== key) {
          disposeHoverSprite();
          const first = diffStatus ? `${label.id} · ${diffStatus}` : label.id;
          const texts = label.name ? [first, label.name] : [first];
          hoverSprite = billboard(
            texts.map((text, i) => ({ text, size: 11, bold: true, dy: (i - (texts.length - 1) / 2) * 14 })),
            C.constraint,
            11,
            false,
          );
          hoverSprite.userData.id = key;
          ctx.scene.add(hoverSprite);
        }
        hoverSprite.position.copy(hit.point);
      }
    } catch (e) {
      console.error("hover pick failed", e);
    } finally {
      hoverPicking = false;
      if (hoverQueued) void runHoverPicks();
    }
  }

  ctx.canvas.addEventListener("pointermove", (e) => {
    lastPointer = { x: e.clientX, y: e.clientY };
    // Walk mode keeps pointermove firing when pointer lock is refused, so gate on it here too.
    if (!identifying || ctx.snapshot || ctx.isWalking() || e.buttons !== 0) {
      hideHover();
      return;
    }
    hoverQueued = { x: e.clientX, y: e.clientY };
    void runHoverPicks();
  });
  ctx.canvas.addEventListener("pointerleave", hideHover);

  function reset() {
    hoverEpoch++;
    hideHover();
    elementLabels.clear();
  }

  async function labelsFor(model: FragmentsModel) {
    for (const [localId, item] of await model.getItems()) {
      const label = elementLabel(item.data);
      if (label) elementLabels.set(localId, label);
    }
  }

  return {
    requested: () => !ctx.snapshot && ctx.params.get("ids") === "1",
    setIdentifying,
    isIdentifying: () => identifying,
    repick: repickHover,
    hide: hideHover,
    reset,
    labelsFor,
  };
}
