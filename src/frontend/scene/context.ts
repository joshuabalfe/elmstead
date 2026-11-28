/**
 * The engine state and services the scene modules share: types plus the one shared constant (FADE).
 * A module imports this without
 * importing the engine, so there are no cycles. Mutable state is read through accessors, because a
 * value captured at construction would go stale, the bug class the load epochs guard against.
 */
import type { FragmentsManager, OrthoPerspectiveCamera, SimpleRenderer } from "@thatopen/components";
import type { FragmentsModel } from "@thatopen/fragments";
import type * as THREE from "three";
import type { DiffStatus } from "../../shared/diff/index.js";
import type { CameraView } from "../../shared/render/views.js";
import type { BuildingModel } from "../../shared/schema/schema.js";
import type { StatusById } from "../lib/diff.js";
import type { MeasurementValues, Point3 } from "../lib/measure.js";
import type { ViewerStore } from "../state/store.js";
import type { ElementLabel } from "./element-label.js";

/** Opacity of what Transparency fades. */
export const FADE = 0.35;

declare global {
  interface Window {
    __elmsteadReady?: boolean;
    __elmsteadError?: string;
    /** Increments after a storey choice has been applied and drawn; tests wait on it. */
    __elmsteadStoreyChanges?: number;
    /** Increments when a floor change starts its section sweep, so tests can tell it from an instant change. */
    __elmsteadStoreySweeps?: number;
    /** Increments after a revision choice has been loaded and drawn; tests wait on it. */
    __elmsteadRevisionChanges?: number;
    /** Increments after a rebuilt IFC has replaced the shown scene; tests wait on it. */
    __elmsteadReloads?: number;
    /** Increments when a Diff or Transparency toggle starts its crossfade; tests read it. */
    __elmsteadViewFades?: number;
    /** Increments after a Diff, Transparency or changes-panel choice has been applied and drawn. */
    __elmsteadViewChanges?: number;
    /** Increments after a view choice has been applied and drawn; the snapshot driver waits on it. */
    __elmsteadViews?: number;
    /** Snapshot-only handle the driver uses to switch views without a page load. */
    __elmsteadChooseView?: (view: CameraView) => Promise<void>;
    /** The shown diff's ids by status while Diff mode is on, for tests; null otherwise. */
    __elmsteadDiff?: Record<DiffStatus, string[]> | null;
    /** Why part of the view could not be drawn (a base model not built), for snapshots; "" when none. */
    __elmsteadNote?: string;
    /** Outline pieces drawn per diff status, for tests. */
    __elmsteadOutlines?: Record<DiffStatus, number>;
    /** The base elements drawn as ghosts, by id, for tests. */
    __elmsteadGhosts?: string[];
    __elmsteadMeasurements?: { id: number; from: Point3; to: Point3; values: MeasurementValues }[];
    __elmsteadHover?: { id: string; name: string | null; status?: DiffStatus } | null;
    /** The text lines of each room label, in storey order; tests read it. */
    __elmsteadRoomLabels?: string[][];
  }
}

export interface SceneContext {
  readonly params: URLSearchParams;
  readonly snapshot: boolean;
  readonly store: ViewerStore;
  readonly scene: THREE.Scene;
  readonly camera: OrthoPerspectiveCamera;
  readonly renderer: SimpleRenderer;
  readonly fragments: FragmentsManager;
  readonly canvas: HTMLCanvasElement;
  prefersReducedMotion(): boolean;
  /** The label, plan and constraint groups drawn for each storey. */
  storeyLayers(): Map<string, THREE.Group[]>;
  /** Show or hide the plan's floor-fill and wall-top layers, as plan style does. */
  setPlanVisible(on: boolean): void;
  /** The one material every constraint span shares, which the sweep must not fade. */
  constraintLineMaterial(): THREE.Material;
  /** The loaded Fragments model; null while none is shown. */
  currentModel(): FragmentsModel | null;
  /** The shown name, `model` or `model@revision`, for the status line. */
  currentName(): string;
  /** The shown model's JSON; null when it has none. */
  modelJson(): BuildingModel | null;
  /** The two view toggles: Diff and Transparency. */
  viewState(): { diff: boolean; xray: boolean };
  /** Whether a storey is in the `?storeys=` selection (every storey when absent). */
  isShown(storey: string): boolean;
  /** The shown storeys' plan extent, for framing walk mode and the compass. */
  shownBox(): THREE.Box3;
  /** The lowest shown floor's elevation in scene metres; null without model JSON. */
  lowestElevation(): number | null;
  /** The base model drawn as removed-element ghosts while Diff is on; null otherwise. */
  ghostModel(): FragmentsModel | null;
  /** The model id and name of a ghost item, for hover. */
  ghostLabel(localId: number): ElementLabel | undefined;
  /** The shown diff's status for an element id, while Diff is on. */
  diffStatusOf(id: string): DiffStatus | undefined;
  /** The revision's diff and base while Diff is on; null otherwise. */
  shownDiff(): { baseName: string; base: BuildingModel; status: StatusById } | null;
  /** Each element id's storey in a model, from its JSON. */
  storeyIndex(model: BuildingModel): Map<string, string>;
  /** Load a model for dressing, keeping it resident; null when its IFC is not built. */
  loadResident(name: string, group: string): Promise<FragmentsModel | null>;
  /** The plan's floor-fill and wall-top layers, which Transparency fades. */
  planLayers(): THREE.Group;
  /** Set the status line's note for what Diff could not draw. */
  setDiffNote(note: string): void;
  /** Hide/show diff outlines and ghosts with their storeys, for an instant selection. */
  setDressingStoreyVisibility(): Promise<void>;
  /** Refresh the changes panel from the current diff and storey selection. */
  publishChanges(): void;
  hideHover(): void;
  isWalking(): boolean;
  setMeasuring(on: boolean): void;
  clearMeasurements(): void;
  updateCompass(): void;
  updateLabelOrientation(): void;
  /** Refresh the compass, flat labels and hover after walk mode restores the camera. */
  onWalkExit(): void;
  /** Leave walk mode, restoring the saved camera. */
  exitWalk(): Promise<void>;
}
