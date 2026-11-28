/**
 * The measurement tool: pick two snapped points, draw the measurement above the model, and list it
 * in the panel. It owns its layer, materials, pick queue and pointer listeners; the engine only
 * starts and stops it.
 */
import { SnappingClass } from "@thatopen/fragments";
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { C } from "../../shared/render/style.js";
import {
  SNAP_MAX_PX,
  axisAlignedPoint,
  isMeasureGesture,
  measurementLines,
  measurementSummary,
  measurementValues,
  nearestSnap,
  type MeasurementValues,
  type SnapCandidate,
} from "../lib/measure.js";
import { billboard } from "./billboard.js";
import type { SceneContext } from "./context.js";
import { disposeTree } from "./dispose.js";

export interface MeasureTool {
  /** Whether `?measure=1` asks for the tool at startup (snapshots never measure). */
  requested(): boolean;
  setMeasuring(on: boolean): void;
  toggle(): Promise<void>;
  clear(): void;
}

export function createMeasureTool(ctx: SceneContext): MeasureTool {
  /** One completed measurement: its scene points and millimetre values. */
  interface Measurement {
    id: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    values: MeasurementValues;
  }

  /** Measurements, drawn above the model so a wall, floor or storey can never hide them. */
  const layer = new THREE.Group();
  ctx.scene.add(layer);
  const lineMaterial = new LineMaterial({
    color: C.measure,
    linewidth: 0.03,
    worldUnits: true,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const markerGeometry = new THREE.SphereGeometry(0.025, 12, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: C.measure,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

  let measuring = false;
  let measureEpoch = 0;
  let pendingPoint: THREE.Vector3 | null = null;
  let nextMeasurementId = 1;
  const measurements: Measurement[] = [];
  let queuedPick: { x: number; y: number } | null = null;
  let picking = false;
  let pointerCandidate: { id: number; x: number; y: number } | null = null;
  const pointers = new Set<number>();
  let pendingMarker: THREE.Mesh | null = null;
  window.__elmsteadMeasurements = [];

  function measureLine(from: THREE.Vector3, to: THREE.Vector3): Line2 {
    const geometry = new LineGeometry();
    geometry.setPositions([from.x, from.y, from.z, to.x, to.y, to.z]);
    const line = new Line2(geometry, lineMaterial);
    line.frustumCulled = false;
    line.renderOrder = 8;
    return line;
  }

  function measureMarker(at: THREE.Vector3): THREE.Mesh {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(at);
    marker.renderOrder = 9;
    return marker;
  }

  function measureBillboard(id: number, values: MeasurementValues): THREE.Sprite {
    const step = 14;
    return billboard(
      measurementLines(id, values).map((text, i) => ({
        text,
        size: i === 0 ? 12 : 11,
        bold: i === 0,
        dy: (i - 1) * step,
      })),
      C.measure,
      10,
      false, // above the model and the other overlays, like the measurement line
    );
  }

  function renderMeasurement(m: Measurement) {
    layer.add(measureLine(m.from, m.to));
    layer.add(measureMarker(m.from));
    layer.add(measureMarker(m.to));
    const label = measureBillboard(m.id, m.values);
    label.position.copy(m.from.clone().add(m.to).multiplyScalar(0.5));
    layer.add(label);
  }

  function removePendingMarker() {
    if (pendingMarker) {
      layer.remove(pendingMarker);
      pendingMarker = null;
    }
  }

  function showPendingMarker(at: THREE.Vector3) {
    removePendingMarker();
    pendingMarker = measureMarker(at);
    layer.add(pendingMarker);
  }

  function clearLayer() {
    // Every measurement line shares one material, and every marker one geometry and material.
    const shared = new Set<THREE.BufferGeometry | THREE.Material>([lineMaterial, markerGeometry, markerMaterial]);
    for (const obj of layer.children) disposeTree(obj, shared);
    layer.clear();
    pendingMarker = null;
  }

  function updateHook() {
    window.__elmsteadMeasurements = measurements.map((m) => ({
      id: m.id,
      from: { x: m.from.x, y: m.from.y, z: m.from.z },
      to: { x: m.to.x, y: m.to.y, z: m.to.z },
      values: { ...m.values },
    }));
  }

  function updateList() {
    ctx.store.set({
      measurements: measurements.map((m) => ({ id: m.id, summary: measurementSummary(m.id, m.values) })),
    });
  }

  function updateClearButton() {
    ctx.store.set({ canClear: measurements.length > 0 || pendingPoint !== null });
  }

  function updateUi() {
    updateList();
    updateHook();
    updateClearButton();
  }

  function addPickPoint(point: THREE.Vector3) {
    if (!measuring) return;
    if (pendingPoint) {
      const aligned = axisAlignedPoint(pendingPoint, point);
      const to = new THREE.Vector3(aligned.x, aligned.y, aligned.z);
      const measurement: Measurement = {
        id: nextMeasurementId++,
        from: pendingPoint,
        to,
        values: measurementValues(pendingPoint, to),
      };
      pendingPoint = null;
      removePendingMarker();
      measurements.push(measurement);
      renderMeasurement(measurement);
      updateUi();
    } else {
      pendingPoint = point.clone();
      showPendingMarker(pendingPoint);
      updateClearButton();
    }
  }

  /** Cancel the unfinished first point; completed measurements stay. */
  function cancelPending() {
    measureEpoch++;
    queuedPick = null;
    pendingPoint = null;
    removePendingMarker();
    updateClearButton();
  }

  function clear() {
    measureEpoch++;
    queuedPick = null;
    pendingPoint = null;
    measurements.length = 0;
    nextMeasurementId = 1;
    clearLayer();
    updateUi();
  }

  function setMeasuring(on: boolean) {
    if (measuring === on) return;
    if (!on) cancelPending();
    measuring = on;
    ctx.store.set({ measuring: on, measureHint: on });
  }

  async function toggle() {
    if (measuring) {
      setMeasuring(false);
      return;
    }
    await ctx.exitWalk();
    setMeasuring(true);
  }

  /** The snapped or face point under a client-space position, in scene metres. */
  async function pickAt(x: number, y: number): Promise<THREE.Vector3 | null> {
    const model = ctx.currentModel();
    if (!model) return null;
    const camera = ctx.camera.three;
    const mouse = new THREE.Vector2(x, y);
    const results = await model.raycastWithSnapping({
      camera,
      mouse,
      dom: ctx.canvas,
      snappingClasses: [SnappingClass.POINT, SnappingClass.LINE],
    });
    const rect = ctx.canvas.getBoundingClientRect();
    const candidates: SnapCandidate<THREE.Vector3>[] = [];
    for (const result of results ?? []) {
      if (result.snappingClass !== SnappingClass.POINT && result.snappingClass !== SnappingClass.LINE) continue;
      const projected = result.point.clone().project(camera);
      candidates.push({
        x: rect.left + ((projected.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - projected.y) / 2) * rect.height,
        point: result.snappingClass === SnappingClass.POINT,
        at: result.point,
      });
    }
    const snap = nearestSnap(candidates, { x, y }, SNAP_MAX_PX);
    if (snap) return snap.at.clone();
    const face = await model.raycast({ camera, mouse: new THREE.Vector2(x, y), dom: ctx.canvas });
    return face ? face.point.clone() : null;
  }

  /** Resolve queued clicks one at a time; a click during a pick waits for it. */
  async function runPicks() {
    if (picking) return;
    picking = true;
    try {
      while (queuedPick) {
        const next = queuedPick;
        queuedPick = null;
        const epoch = measureEpoch;
        const model = ctx.currentModel();
        if (!measuring || !model) continue;
        const point = await pickAt(next.x, next.y);
        if (point && epoch === measureEpoch && ctx.currentModel() === model && measuring) addPickPoint(point);
      }
    } catch (e) {
      console.error("measure pick failed", e);
    } finally {
      picking = false;
      if (queuedPick && measuring) void runPicks();
    }
  }

  function queuePick(x: number, y: number) {
    if (!measuring || ctx.snapshot) return;
    queuedPick = { x, y };
    void runPicks();
  }

  ctx.canvas.addEventListener("pointerdown", (e) => {
    if (!measuring || ctx.snapshot) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.add(e.pointerId);
    if (pointers.size > 1) {
      pointerCandidate = null;
      return;
    }
    pointerCandidate = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });

  ctx.canvas.addEventListener("pointerup", (e) => {
    const candidate = pointerCandidate;
    pointers.delete(e.pointerId);
    if (!measuring || ctx.snapshot) return;
    if (!candidate || candidate.id !== e.pointerId) return;
    pointerCandidate = null;
    if (!isMeasureGesture(candidate, { x: e.clientX, y: e.clientY })) return;
    queuePick(e.clientX, e.clientY);
  });

  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointerCandidate?.id === e.pointerId) pointerCandidate = null;
  };
  ctx.canvas.addEventListener("pointercancel", endPointer);
  window.addEventListener("blur", () => {
    pointers.clear();
    pointerCandidate = null;
  });

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape" || !measuring || ctx.snapshot) return;
    if (pendingPoint) cancelPending();
    else setMeasuring(false);
  });
  updateUi();

  return {
    requested: () => !ctx.snapshot && ctx.params.get("measure") === "1",
    setMeasuring,
    toggle,
    clear,
  };
}
