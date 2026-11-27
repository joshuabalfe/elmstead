import type { DiffStatus } from "../../shared/diff/index.js";
import type { CameraView } from "../../shared/render/views.js";

export interface ModelOption {
  value: string;
  text: string;
  disabled?: boolean;
}

export interface StoreyOption {
  value: string;
  text: string;
}

export interface MeasurementRow {
  id: number;
  summary: string;
}

export interface ViewLabel {
  view: CameraView;
  label: string;
  title: string;
}

export interface ChangeCategory {
  status: DiffStatus;
  count: number;
  checked: boolean;
  fill: string;
  accent: string;
}

export interface ChangeEntry {
  id: string;
  status: DiffStatus;
  label: string;
  color: string;
}

export interface ChangeGroup {
  storeyId: string;
  storeyName: string;
  entries: ChangeEntry[];
}

export interface ChangesState {
  categories: ChangeCategory[];
  groups: ChangeGroup[];
}

export interface ViewerState {
  /** The status line: the model being loaded or shown, or an error. */
  status: string;
  /** Every model in the output directory, for the model picker. */
  models: string[];
  /** The chosen base model. */
  model: string;
  /** The chosen model's revisions, Existing first. */
  revisions: ModelOption[];
  /** The shown revision, or null for Existing. */
  revision: string | null;
  /** True when the model has no revisions, so the revision picker is disabled. */
  revisionDisabled: boolean;
  /** The model's storeys, lowest first. */
  storeys: StoreyOption[];
  /** True for a single-storey model, where the storey selector is disabled. */
  storeyDisabled: boolean;
  /** The highest storey shown, as an index into `storeys` (lowest first). */
  storeyIndex: number;
  /** True when `?storeys=` names a set no single floor describes. */
  storeyCustom: boolean;
  /** The camera snaps' labels and tooltips, with Top. */
  viewLabels: ViewLabel[];
  labels: boolean;
  constraints: boolean;
  ids: boolean;
  measuring: boolean;
  /** True while a pending point or a measurement can be cleared. */
  canClear: boolean;
  walking: boolean;
  /** The click-to-look prompt while walk mode lacks pointer lock. */
  walkHint: boolean;
  /** The measure-mode hint. */
  measureHint: boolean;
  diff: boolean;
  /** True for a revision, where Diff is offered. */
  diffAvailable: boolean;
  xray: boolean;
  measurements: MeasurementRow[];
  /** The changes panel while Diff is on; null otherwise. */
  changes: ChangesState | null;
  ready: boolean;
  error: string | null;
}

export const initialState: ViewerState = {
  status: "",
  models: [],
  model: "",
  revisions: [],
  revision: null,
  revisionDisabled: true,
  storeys: [],
  storeyDisabled: true,
  storeyIndex: 0,
  storeyCustom: false,
  viewLabels: [],
  labels: true,
  constraints: false,
  ids: false,
  measuring: false,
  canClear: false,
  walking: false,
  walkHint: false,
  measureHint: false,
  diff: false,
  diffAvailable: false,
  xray: false,
  measurements: [],
  changes: null,
  ready: false,
  error: null,
};

/** The viewer's discrete UI state, read by React with useSyncExternalStore. */
export class ViewerStore {
  private state: ViewerState;
  private listeners = new Set<() => void>();

  constructor(initial: ViewerState = initialState) {
    this.state = initial;
  }

  getSnapshot = (): ViewerState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(patch: Partial<ViewerState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof ViewerState)[]) {
      if (patch[key] !== this.state[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
