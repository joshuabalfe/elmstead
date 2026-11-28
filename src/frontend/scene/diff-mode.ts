/**
 * Diff mode's state: the shown revision's diff against its base, each listed id's status for the
 * categories the changes panel shows, the panel's own state, and the status-line note for what
 * could not be drawn. The dresser draws it and the labels build its plan layers.
 */
import type { DiffStatus, ModelDiff } from "../../shared/diff/index.js";
import { diffModels } from "../../shared/diff/index.js";
import type { BuildingModel } from "../../shared/schema/schema.js";
import { DIFF_COLOURS, statusById, type StatusById } from "../lib/diff.js";
import { splitName } from "../lib/revisions.js";
import type { ChangeCategory, ChangeGroup } from "../state/store.js";
import type { SceneContext } from "./context.js";

export interface ShownDiff {
  baseName: string;
  base: BuildingModel;
  diff: ModelDiff;
  status: StatusById;
}

export interface DiffMode {
  /** The shown revision's diff and base while Diff is on; null otherwise. */
  shown(): ShownDiff | null;
  /** The shown diff's status for an element id. */
  statusOf(id: string): DiffStatus | undefined;
  /** The status-line note for what Diff could not draw. */
  note(): string;
  setNote(note: string): void;
  /** Work out the diff of `name` against its base and publish the changes panel. */
  refresh(name: string, json: BuildingModel | null): Promise<void>;
  /** Republish the changes panel from the current diff and storey selection. */
  publish(): void;
  setCategory(status: DiffStatus, on: boolean): void;
  /** Drop a rebuilt base's cached JSON so the next refresh fetches it again. */
  forget(name: string): void;
}

const SIGN: Record<DiffStatus, string> = { added: "+", changed: "~", removed: "−" };

export function createDiffMode(ctx: SceneContext): DiffMode {
  /** The shown revision's diff while Diff mode is on: its base, the diff, and each listed id's status. */
  let shown: ShownDiff | null = null;
  /** Each base model's JSON once fetched, for diffing its revisions. */
  const baseJson = new Map<string, BuildingModel | null>();
  /** Which diff categories the changes panel shows. */
  const categories: Record<DiffStatus, boolean> = { added: true, changed: true, removed: true };
  /** Status-line note for what Diff could not draw. */
  let note = "";
  window.__elmsteadDiff = null;

  function setNote(next: string) {
    note = next;
  }

  /**
   * The changes panel's state, while Diff mode is on: each category's count with a checkbox to show
   * or hide it, then every change of the shown storeys, by storey, each framing its element when
   * clicked.
   */
  function publish() {
    if (!shown || ctx.snapshot) {
      ctx.store.set({ changes: null });
      return;
    }
    const { diff, base } = shown;
    const listed: ChangeCategory[] = (["added", "changed", "removed"] as const).map((status) => ({
      status,
      count: diff[status].length,
      checked: categories[status],
      fill: DIFF_COLOURS[status].fill,
      accent: DIFF_COLOURS[status].accent,
    }));
    const storeys = ctx.modelJson()?.storeys ?? base.storeys;
    const groups: ChangeGroup[] = [];
    for (const storey of storeys) {
      if (!ctx.isShown(storey.id)) continue;
      const entries = (["added", "changed", "removed"] as const).flatMap((status) =>
        categories[status]
          ? diff[status]
              .filter((e) => e.storey === storey.id)
              .map((e) => ({ id: e.id, status, label: `${SIGN[status]} ${e.id}`, color: DIFF_COLOURS[status].accent }))
          : [],
      );
      if (entries.length) groups.push({ storeyId: storey.id, storeyName: storey.name, entries });
    }
    ctx.store.set({ changes: { categories: listed, groups } });
  }

  /**
   * The diff of revision `name` against its base, while Diff mode is on: fetched and computed, with
   * each listed id's status for the categories the panel shows. Null on a base model or with Diff off.
   */
  async function refresh(name: string, json: BuildingModel | null) {
    const { model: baseName, revision: rev } = splitName(name);
    note = "";
    if (!ctx.viewState().diff || rev === null || !json) {
      shown = null;
    } else {
      if (!baseJson.has(baseName)) {
        const res = await fetch(`/out/${baseName}.building.json`);
        baseJson.set(baseName, res.ok ? ((await res.json()) as BuildingModel) : null);
      }
      const base = baseJson.get(baseName) ?? null;
      if (!base) {
        shown = null;
        note = ` · Diff needs ${baseName} built`;
      } else {
        const diff = diffModels(base, json);
        shown = { baseName, base, diff, status: statusById(diff, categories) };
      }
    }
    window.__elmsteadDiff = shown
      ? {
          added: shown.diff.added.map((e) => e.id),
          changed: shown.diff.changed.map((e) => e.id),
          removed: shown.diff.removed.map((e) => e.id),
        }
      : null;
    publish();
  }

  return {
    shown: () => shown,
    statusOf: (id) => shown?.status.get(id),
    note: () => note,
    setNote,
    refresh,
    publish,
    setCategory: (status, on) => {
      categories[status] = on;
    },
    forget: (name) => {
      baseJson.delete(name);
    },
  };
}
