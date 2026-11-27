/**
 * The storey section sweep: a floor choice eases a clipping plane between the two floor levels,
 * fading storeys in and out around it, and retargets while the user keeps stepping. It owns the
 * plane, the per-storey entries and the retarget chain; the engine owns the storey selection and
 * the layers drawn for each storey.
 */
import type { FragmentsModel } from "@thatopen/fragments";
import * as THREE from "three";
import { wallHeight } from "../../shared/geometry/wall.js";
import type { Storey } from "../../shared/schema/schema.js";
import { storeysLowestFirst } from "../lib/storeys.js";
import { FADE, type SceneContext } from "./context.js";
import { LABEL_LIFT } from "./lifts.js";

export interface StoreyMotion {
  /** Apply the storey selection: instantly by default, or with the section sweep when `animate`. */
  apply(model: FragmentsModel, animate?: boolean): Promise<void>;
  /** Finish any floor change at once, queued behind a retarget already in flight. */
  finish(): Promise<void>;
  /** Forget the storeys last fully shown, at the start of a load. */
  reset(): void;
}

/** How long a floor change takes to ease to its new floor level, in milliseconds. */
const STOREY_EASE_MS = 60;
/** Exponential time constant: about 95% of a floor change is done after STOREY_EASE_MS. */
const STOREY_TAU_MS = STOREY_EASE_MS / 3;

/**
 * A height clear of every model, where the sweep plane rests between floor changes. The plane stays
 * in the renderer at all times, so materials compile with clipping once rather than on a first
 * sweep; between sweeps it clips nothing.
 */
const SWEEP_PARKED = 1_000_000;

/**
 * A sweep height that keeps a floor's drawings: clear of its wall tops and labels. The next
 * storey's floor structure starts just above it, so a thin sliver can show at the cut.
 */
const SWEEP_MARGIN = (LABEL_LIFT + 2) / 1000;

interface StoreyLayerFade {
  materials: {
    material: THREE.Material;
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
  }[];
}

/** One storey crossing the section plane: its items, overlay groups and current fade. */
interface StoreyMotionEntry {
  id: string;
  items: number[];
  groups: THREE.Group[];
  layers: StoreyLayerFade | null;
  opacity: number;
  /** The opacity the storey rests at when shown: 1, or the see-through opacity under Transparency. */
  rest: number;
  target: number;
}

/** A floor change in flight: every transitioning storey and the plane easing to its new level. */
interface Motion {
  model: FragmentsModel;
  entries: Map<string, StoreyMotionEntry>;
  target: Set<string>;
  plane: number;
  targetPlane: number;
  running: boolean;
  waiters: (() => void)[];
}

/**
 * The height (scene m) any of a storey's elements reaches. A storey with no walls, such as the
 * street level, is topped by its railings; a stair climbs to the storey above.
 */
export function storeyTop(storey: Storey, byId: Map<string, Storey>): number {
  let top = storey.elevation + Math.max(0, ...storey.walls.map((w) => wallHeight(w)));
  for (const o of storey.openings) top = Math.max(top, storey.elevation + o.sillHeight + o.height);
  for (const slab of storey.slabs) top = Math.max(top, storey.elevation + slab.elevationOffset);
  for (const r of storey.railings ?? [])
    top = Math.max(top, storey.elevation + Math.max(r.startBase ?? 0, r.endBase ?? 0) + r.height);
  for (const st of storey.stairs ?? []) top = Math.max(top, byId.get(st.toStoreyId)?.elevation ?? storey.elevation);
  return top / 1000;
}

export function createStoreyMotion(ctx: SceneContext): StoreyMotion {
  /**
   * The section plane a floor change sweeps: it clips everything above its height. The renderer
   * holds this one array by reference, so moving the plane is picked up in place.
   */
  const sweepPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), SWEEP_PARKED);
  const sweepPlanes: THREE.Plane[] = [sweepPlane];
  ctx.renderer.three.clippingPlanes = sweepPlanes;

  /** Each storey's items, read once per loaded model so a sweep need not walk the model again. */
  let itemCache: { modelId: string; byStorey: Map<string, number[]> } | null = null;

  /** The storeys last fully shown; null until the first model's storeys have been applied. */
  let settledStoreys: Set<string> | null = null;

  let motion: Motion | null = null;
  /** Retargets run in order, so two quick choices cannot both create the same storey's entry. */
  let chain: Promise<void> = Promise.resolve();

  /**
   * Make a storey's overlay layers fadeable, remembering their resting states. The constraint spans
   * share one material across storeys, so they are left alone and pop with their storey instead.
   */
  function beginLayerFade(groups: THREE.Group[]): StoreyLayerFade {
    const seen = new Set<THREE.Material>();
    const materials: StoreyLayerFade["materials"] = [];
    for (const group of groups) {
      group.traverse((object) => {
        const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!material) return;
        for (const m of Array.isArray(material) ? material : [material]) {
          if (m === ctx.constraintLineMaterial() || seen.has(m)) continue;
          seen.add(m);
          materials.push({ material: m, opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite });
          if (!m.transparent) {
            m.transparent = true;
            m.needsUpdate = true;
          }
          if (m.depthWrite) {
            m.depthWrite = false;
            m.needsUpdate = true;
          }
        }
      });
    }
    return { materials };
  }

  function applyLayerFade(layers: StoreyLayerFade, t: number): void {
    for (const { material, opacity } of layers.materials) material.opacity = opacity * t;
  }

  function endLayerFade(layers: StoreyLayerFade): void {
    for (const { material, opacity, transparent, depthWrite } of layers.materials) {
      material.opacity = opacity;
      material.transparent = transparent;
      material.depthWrite = depthWrite;
      material.needsUpdate = true;
    }
  }

  /** The items each storey owns, from the model JSON: the IFC is the geometry, the JSON the authority. */
  async function storeyItemsOf(model: FragmentsModel): Promise<Map<string, number[]>> {
    if (itemCache?.modelId === model.modelId) return itemCache.byStorey;
    const byStorey = new Map<string, number[]>();
    const json = ctx.modelJson();
    if (!json) return byStorey;
    const owner = ctx.storeyIndex(json);
    // Fragments' spatial tree does not surface every storey, so map items by their Tag (elements) or
    // Name (spaces, whose Tag the writer leaves empty) instead of walking it.
    for (const [localId, item] of await model.getItems()) {
      const key = (item.data.Tag?.value ?? item.data.Name?.value) as string | undefined;
      const storey = key ? owner.get(key) : undefined;
      if (!storey) continue;
      byStorey.set(storey, [...(byStorey.get(storey) ?? []), localId]);
    }
    itemCache = { modelId: model.modelId, byStorey };
    return byStorey;
  }

  /** Finish a floor change at once: every transitioning storey at its target, the plane parked. */
  async function finishNow(): Promise<void> {
    const current = motion;
    if (!current) return;
    motion = null;
    for (const entry of current.entries.values()) {
      if (entry.target > 0) {
        if (entry.items.length) {
          if (entry.rest === 1) await current.model.resetOpacity(entry.items);
          else await current.model.setOpacity(entry.items, entry.rest);
        }
        if (entry.layers) endLayerFade(entry.layers);
      } else {
        if (entry.items.length) {
          await current.model.setVisible(entry.items, false);
          await current.model.resetOpacity(entry.items);
        }
        if (entry.layers) endLayerFade(entry.layers);
        for (const group of entry.groups) group.visible = false;
      }
    }
    await ctx.fragments.core.update(true);
    sweepPlane.constant = SWEEP_PARKED;
    settledStoreys = new Set(current.target);
    await ctx.fragments.core.update(true);
    for (const resolve of current.waiters.splice(0)) resolve();
  }

  /** Finish any floor change at once, queued behind a retarget already in flight. */
  function finish(): Promise<void> {
    chain = chain.then(finishNow);
    return chain;
  }

  /** Resolves once the running floor change has settled, even if another target arrives first. */
  function motionSettled(): Promise<void> {
    const current = motion;
    if (!current) return Promise.resolve();
    return new Promise((resolve) => current.waiters.push(resolve));
  }

  /**
   * The opacity a shown storey rests at. Transparency fades every element, so entering and leaving
   * storeys sweep between 0 and that opacity rather than 0 and 1.
   */
  function storeyRestOpacity(): number {
    return ctx.viewState().xray ? FADE : 1;
  }

  /** Hide and restore each storey the motion has finished with; park the plane when none is left. */
  async function settle(current: Motion): Promise<void> {
    if (motion !== current) return;
    for (const [id, entry] of [...current.entries]) {
      if (entry.target === 0 && entry.opacity === 0) {
        if (entry.items.length) {
          await current.model.setVisible(entry.items, false);
          await current.model.resetOpacity(entry.items);
        }
        if (entry.layers) endLayerFade(entry.layers);
        for (const group of entry.groups) group.visible = false;
        current.entries.delete(id);
      } else if (entry.target > 0 && entry.opacity === entry.target) {
        if (entry.items.length) {
          if (entry.rest === 1) await current.model.resetOpacity(entry.items);
          else await current.model.setOpacity(entry.items, entry.rest);
        }
        if (entry.layers) endLayerFade(entry.layers);
        entry.layers = null;
        current.entries.delete(id);
      }
    }
    if (motion !== current) return;
    if (current.entries.size > 0) {
      start(current);
      return;
    }
    // Flush at the clipped state before parking, so the last frame cannot show stale geometry.
    await ctx.fragments.core.update(true);
    sweepPlane.constant = SWEEP_PARKED;
    settledStoreys = new Set(current.target);
    motion = null;
    await ctx.fragments.core.update(true);
    for (const resolve of current.waiters.splice(0)) resolve();
  }

  /** Ease every transitioning storey and the plane toward its target; settle when all arrive. */
  function start(current: Motion): void {
    if (current.running) return;
    current.running = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (motion !== current) return;
      const dt = Math.min(64, Math.max(0, now - last));
      last = now;
      const k = 1 - Math.exp(-dt / STOREY_TAU_MS);
      current.plane += (current.targetPlane - current.plane) * k;
      if (Math.abs(current.targetPlane - current.plane) < 0.0005) current.plane = current.targetPlane;
      sweepPlane.constant = current.plane;
      let moving = current.plane !== current.targetPlane;
      for (const entry of current.entries.values()) {
        entry.opacity += (entry.target - entry.opacity) * k;
        if (Math.abs(entry.target - entry.opacity) < 0.01) entry.opacity = entry.target;
        if (entry.layers) applyLayerFade(entry.layers, entry.opacity / entry.rest);
        if (entry.items.length) void current.model.setOpacity(entry.items, entry.opacity);
        if (entry.opacity !== entry.target) moving = true;
      }
      ctx.fragments.core.update();
      if (moving) {
        requestAnimationFrame(tick);
        return;
      }
      current.running = false;
      chain = chain.then(() => settle(current));
    };
    requestAnimationFrame(tick);
  }

  /** Point the running floor change at `target`, creating or flipping storeys as needed. */
  function retarget(model: FragmentsModel, ordered: Storey[], target: Set<string>): Promise<void> {
    chain = chain.then(async () => {
      const byStorey = await storeyItemsOf(model);
      const byId = new Map(ctx.modelJson()!.storeys.map((s) => [s.id, s]));
      const highest = (list: Storey[]) => (list.length ? Math.max(...list.map((s) => storeyTop(s, byId))) : 0);
      const rest = storeyRestOpacity();
      if (!motion || motion.model !== model) {
        await finishNow();
        const shown = settledStoreys ?? new Set(ordered.map((s) => s.id));
        const plane = highest(ordered.filter((s) => shown.has(s.id))) + SWEEP_MARGIN;
        sweepPlane.constant = plane;
        motion = {
          model,
          entries: new Map(),
          target,
          plane,
          targetPlane: highest(ordered.filter((s) => target.has(s.id))) + SWEEP_MARGIN,
          running: false,
          waiters: [],
        };
        window.__elmsteadStoreySweeps = (window.__elmsteadStoreySweeps ?? 0) + 1;
      } else {
        motion.target = target;
        motion.targetPlane = highest(ordered.filter((s) => target.has(s.id))) + SWEEP_MARGIN;
      }
      const current = motion;
      const shown = settledStoreys ?? new Set(ordered.map((s) => s.id));
      for (const storey of ordered) {
        const entry = current.entries.get(storey.id);
        const inTarget = target.has(storey.id);
        if (entry) {
          entry.target = inTarget ? entry.rest : 0;
          if (!inTarget && !entry.layers) entry.layers = beginLayerFade(entry.groups);
          continue;
        }
        const wasShown = shown.has(storey.id);
        if (inTarget === wasShown) continue;
        const groups = ctx.storeyLayers().get(storey.id) ?? [];
        const items = byStorey.get(storey.id) ?? [];
        const layers = beginLayerFade(groups);
        if (inTarget) {
          applyLayerFade(layers, 0);
          for (const group of groups) group.visible = true;
          if (items.length) {
            // Fade it while still hidden, so showing it cannot flash at full opacity first.
            await model.setOpacity(items, 0);
            await model.setVisible(items, true);
          }
          current.entries.set(storey.id, { id: storey.id, items, groups, layers, opacity: 0, rest, target: rest });
        } else {
          applyLayerFade(layers, 1);
          current.entries.set(storey.id, { id: storey.id, items, groups, layers, opacity: rest, rest, target: 0 });
        }
      }
      start(current);
    });
    return chain;
  }

  /**
   * Show exactly the selected storeys through fragments: each item is visible when the storey its Tag
   * — or its Name, for spaces — belongs to is. Items that name no model element are left alone; they
   * carry no geometry. Storey layers follow the same selection, so labels, floors and constraints
   * travel with their storey. A floor choice sweeps a section plane between the two floor levels,
   * fading the storeys at Transparency's opacity when it is on; snapshots, Diff and reduced motion
   * apply the choice at once, as does a model's first application.
   */
  async function apply(model: FragmentsModel, animate = false) {
    const json = ctx.modelJson();
    if (!json) return;
    const ordered = storeysLowestFirst(json);
    const target = new Set(ordered.filter((s) => ctx.isShown(s.id)).map((s) => s.id));
    const sweepNow = animate && !ctx.snapshot && !ctx.viewState().diff && !ctx.prefersReducedMotion();
    if (!sweepNow) {
      await finish();
      for (const [storey, ids] of await storeyItemsOf(model)) await model.setVisible(ids, ctx.isShown(storey));
      for (const [id, groups] of ctx.storeyLayers()) for (const g of groups) g.visible = ctx.isShown(id);
      await ctx.setDressingStoreyVisibility();
      settledStoreys = target;
      ctx.publishChanges();
      return;
    }
    if (
      !motion &&
      settledStoreys &&
      target.size === settledStoreys.size &&
      [...target].every((id) => settledStoreys!.has(id))
    ) {
      ctx.publishChanges();
      return;
    }
    await retarget(model, ordered, target);
    ctx.publishChanges();
    await motionSettled();
  }

  return {
    apply,
    finish,
    reset: () => {
      settledStoreys = null;
    },
  };
}
