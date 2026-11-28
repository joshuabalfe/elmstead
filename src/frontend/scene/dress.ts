/**
 * Diff dressing: the highlights, outlines and ghosts a revision shows against its base, and the
 * Transparency fade of the plan drawing. The diff itself is computed by the engine; this module
 * draws it and owns everything it adds to the scene.
 */
import type { FragmentsModel } from "@thatopen/fragments";
import * as THREE from "three";
import type { DiffStatus } from "../../shared/diff/index.js";
import { DIFF_COLOURS, type StatusById } from "../lib/diff.js";
import { splitName } from "../lib/revisions.js";
import { FADE, type SceneContext } from "./context.js";
import { disposeTree } from "./dispose.js";
import { elementLabel, type ElementLabel } from "./element-label.js";

export interface Dresser {
  /** Reset the shown model and draw the current Diff and Transparency state. */
  dress(model: FragmentsModel, name: string): Promise<void>;
  /** Remove every outline, ghost and fade from the last dressing. */
  undress(model: FragmentsModel): Promise<void>;
  /** Remove the dressing, or just the ghost base when no model is shown. */
  clearGhost(model: FragmentsModel | null): Promise<void>;
  fadePlan(on: boolean): void;
  ghostModel(): FragmentsModel | null;
  ghostLabel(localId: number): ElementLabel | undefined;
  /** Show each outline and ghost with its storey, for an instant storey choice. */
  setStoreyVisibility(): Promise<void>;
}

export function createDresser(ctx: SceneContext): Dresser {
  /** The diff outlines, one group per storey so they hide with it. */
  const diffOutlines = new Map<string, THREE.Group>();
  /** The base model drawn as removed-element ghosts, while it is. */
  let ghostModel: FragmentsModel | null = null;
  /** Ghost item ids by storey, so the ghosts hide with their storey. */
  let ghostItems = new Map<string, number[]>();
  /** Model id per ghost item, for hover. */
  const ghostLabels = new Map<number, ElementLabel>();
  window.__elmsteadOutlines = { added: 0, changed: 0, removed: 0 };
  window.__elmsteadGhosts = [];

  const outlineMaterials: Record<DiffStatus, THREE.LineBasicMaterial> = {
    added: new THREE.LineBasicMaterial({ color: DIFF_COLOURS.added.accent }),
    changed: new THREE.LineBasicMaterial({ color: DIFF_COLOURS.changed.accent }),
    removed: new THREE.LineBasicMaterial({ color: DIFF_COLOURS.removed.accent }),
  };

  /** The diff's colours, as three.js hex strings, so Transparency can leave the diff's drawing solid. */
  const DIFF_HEX = new Set(
    Object.values(DIFF_COLOURS).flatMap((c) => [c.fill, c.accent, c.floor].map((h) => h.slice(1).toLowerCase())),
  );

  /** Every outline, ghost and fade from the last dressing removed, and the ghost model out of the scene. */
  async function undress(model: FragmentsModel) {
    await model.resetHighlight();
    await model.resetOpacity(undefined);
    for (const g of diffOutlines.values()) {
      g.removeFromParent();
      disposeTree(g, new Set(Object.values(outlineMaterials)));
    }
    diffOutlines.clear();
    window.__elmsteadOutlines = { added: 0, changed: 0, removed: 0 };
    window.__elmsteadGhosts = [];
    if (ghostModel && ghostModel !== model) ctx.scene.remove(ghostModel.object);
    ghostModel = null;
    ghostItems = new Map();
    ghostLabels.clear();
  }

  /**
   * Outlines round items in a status's accent. Fragments draws every item of one material as one mesh
   * and drops its CPU copy of the geometry once it is on the GPU, so the outlines are built from
   * `getItemsGeometry`, each item's own positions, indices and transform.
   */
  async function outline(model: FragmentsModel, byStorey: Map<string, number[]>, status: DiffStatus) {
    for (const [storey, ids] of byStorey) {
      if (!ids.length) continue;
      let group = diffOutlines.get(storey);
      if (!group) {
        group = new THREE.Group();
        group.visible = ctx.isShown(storey);
        diffOutlines.set(storey, group);
      }
      for (const meshes of await model.getItemsGeometry(ids)) {
        for (const m of meshes) {
          if (!m.positions || !m.indices) continue;
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m.positions), 3));
          g.setIndex(new THREE.BufferAttribute(m.indices, 1));
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), outlineMaterials[status]);
          g.dispose();
          edges.applyMatrix4(m.transform);
          group.add(edges);
          window.__elmsteadOutlines![status]++;
        }
      }
      model.object.add(group);
    }
  }

  /** Fragments items by status and storey, from their Tag (Name for spaces), for the ids in `status`. */
  async function itemsByStatus(
    model: FragmentsModel,
    status: StatusById,
    storeyOf: (id: string) => string | undefined,
  ) {
    const out: Record<DiffStatus, Map<string, number[]>> = { added: new Map(), changed: new Map(), removed: new Map() };
    const plain: number[] = [];
    for (const [localId, item] of await model.getItems()) {
      const key = (item.data.Tag?.value ?? item.data.Name?.value) as string | undefined;
      if (!key) continue;
      const s = status.get(key);
      const storey = storeyOf(key);
      if (!s || !storey) {
        plain.push(localId);
        continue;
      }
      out[s].set(storey, [...(out[s].get(storey) ?? []), localId]);
    }
    return { byStatus: out, plain };
  }

  /** The removed elements, drawn from the base model in the removed fill, see-through and outlined. */
  async function dressGhosts(model: FragmentsModel) {
    const diff = ctx.shownDiff();
    if (!diff) return;
    const removed = new Map([...diff.status].filter(([, s]) => s === "removed"));
    if (!removed.size) return;
    const ghost = await ctx.loadResident(diff.baseName, splitName(diff.baseName).model);
    if (!ghost) {
      ctx.setDiffNote(` · removed elements need ${diff.baseName} built`);
      return;
    }
    if (ghost === model) return;
    await ghost.resetHighlight();
    await ghost.resetOpacity(undefined);
    const there = ctx.storeyIndex(diff.base);
    const { byStatus, plain } = await itemsByStatus(ghost, removed, (id) => there.get(id));
    if (plain.length) await ghost.setVisible(plain, false);
    ghostItems = byStatus.removed;
    const ids = [...ghostItems.values()].flat();
    for (const [storey, storeyIds] of ghostItems) await ghost.setVisible(storeyIds, ctx.isShown(storey));
    if (ids.length)
      await ghost.highlight(ids, {
        color: new THREE.Color(DIFF_COLOURS.removed.fill),
        renderedFaces: 1,
        opacity: 0.5,
        transparent: true,
        customId: "diff-removed",
      });
    for (const [localId, item] of await ghost.getItems()) {
      const label = elementLabel(item.data);
      if (label && ids.includes(localId)) ghostLabels.set(localId, label);
    }
    window.__elmsteadGhosts = [...new Set([...ghostLabels.values()].map((l) => l.id))].sort();
    ctx.scene.add(ghost.object);
    ghostModel = ghost;
    await outline(ghost, ghostItems, "removed");
  }

  /**
   * Transparency on the plan drawing: every plan-style layer's materials faded, or back as they were.
   * The diff's own colours stay solid, as the changes do in 3D.
   */
  function fadePlan(on: boolean) {
    ctx.planLayers().traverse((o) => {
      const material = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        const colour = (m as THREE.MeshBasicMaterial).color;
        if (colour && DIFF_HEX.has(colour.getHexString())) continue;
        const was = (m.userData.unfaded ??= { opacity: m.opacity, transparent: m.transparent }) as {
          opacity: number;
          transparent: boolean;
        };
        m.opacity = on ? was.opacity * FADE : was.opacity;
        m.transparent = on || was.transparent;
        m.needsUpdate = true;
      }
    });
  }

  /**
   * The shown model drawn as Diff and Transparency now require: reset first, so a kept revision never
   * keeps an earlier session's colours; then the diff's highlights, outlines and ghosts; then
   * Transparency, on the IFC and on the plan drawing.
   */
  async function dress(model: FragmentsModel, name: string) {
    await undress(model);
    const isRevision = splitName(name).revision !== null;
    const view = ctx.viewState();
    ctx.store.set({ diffAvailable: isRevision, diff: view.diff && isRevision, xray: view.xray });
    const coloured = new Set<number>();
    const diff = ctx.shownDiff();
    const json = ctx.modelJson();
    if (diff && json) {
      const here = ctx.storeyIndex(json);
      const { byStatus } = await itemsByStatus(model, diff.status, (id) => here.get(id));
      // Glazing keeps its transparency: windows are highlighted apart, see-through.
      const windows = new Set<number>();
      for (const [localId, item] of await model.getItems())
        if (String((item as { category?: string }).category) === "IFCWINDOW") windows.add(localId);
      for (const status of ["added", "changed"] as const) {
        const ids = [...byStatus[status].values()].flat();
        if (!ids.length) continue;
        const solid = ids.filter((id) => !windows.has(id));
        const glazed = ids.filter((id) => windows.has(id));
        if (solid.length)
          await model.highlight(solid, {
            color: new THREE.Color(DIFF_COLOURS[status].fill),
            renderedFaces: 1,
            opacity: 1,
            transparent: false,
            customId: `diff-${status}`,
          });
        if (glazed.length)
          await model.highlight(glazed, {
            color: new THREE.Color(DIFF_COLOURS[status].fill),
            renderedFaces: 1,
            opacity: 0.5,
            transparent: true,
            customId: `diff-${status}-glazing`,
          });
        for (const id of ids) coloured.add(id);
        await outline(model, byStatus[status], status);
      }
      await dressGhosts(model);
    }
    if (view.xray) {
      const all = [...(await model.getItems()).keys()];
      const faded = all.filter((id) => !coloured.has(id));
      if (faded.length) await model.setOpacity(faded, FADE);
    }
    fadePlan(view.xray);
    await ctx.fragments.core.update(true);
  }

  async function clearGhost(model: FragmentsModel | null) {
    if (model) {
      await undress(model);
      return;
    }
    if (ghostModel) ghostModel.object.removeFromParent();
    ghostModel = null;
    ghostItems = new Map();
    ghostLabels.clear();
  }

  async function setStoreyVisibility() {
    for (const [id, group] of diffOutlines) group.visible = ctx.isShown(id);
    const ghost = ghostModel;
    if (ghost) for (const [id, ids] of ghostItems) await ghost.setVisible(ids, ctx.isShown(id));
  }

  return {
    dress,
    undress,
    clearGhost,
    fadePlan,
    ghostModel: () => ghostModel,
    ghostLabel: (localId) => ghostLabels.get(localId),
    setStoreyVisibility,
  };
}
