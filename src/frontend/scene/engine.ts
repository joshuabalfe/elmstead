/**
 * Local IFC viewer on That Open Engine: loads out/<model>.ifc, converts it to Fragments in the
 * browser and shows it, with each storey's room names, areas and dimensions lying at its ceiling,
 * the model's constraints as red labels and dotted spans, a distance measurement tool, and a
 * compass pointing to true north (all from out/<model>.building.json and
 * out/<model>.constraints.json). A storey selector in the bar shows every storey up to the chosen
 * floor, and `?storeys=` shows an exact subset. A revision picker beside the model picker switches
 * between a model and its revisions (`?model=<model>@<revision>`) without moving the camera. Every view uses the plan's colours, with the plan's
 * walls, doors and windows laid on the wall tops, so the Top view reads like the plan. Query params:
 * ?model=<name>&view=<sw|se|ne|nw|top (default)>&snapshot=1&labels=0|1&constraints=0|1&storeys=a,b
 * &measure=1&style=plan|ifc&camera=px,py,pz,tx,ty,tz&walk=1&ids=0|1 (snapshot hides the UI and sets
 * window.__elmsteadReady once the first frame is drawn; labels and the plan style are on by
 * default and constraints start off, except in snapshots, which show the IFC alone; walk=1 enters
 * first-person walk mode and measure=1 starts the measurement tool, both ignored in snapshots).
 * The Ids button or ?ids=1 shows each element's model id and name at the hovered point on hover, in the constraint
 * label's style and above everything, and
 * room labels carry the room id under name and area.
 */
import * as OBC from "@thatopen/components";
import { LodMode, SnappingClass, type FragmentsModel } from "@thatopen/fragments";
import workerUrl from "@thatopen/fragments/worker?url";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { STYLES } from "../../shared/ifc/styles.js";
import { wallHeight } from "../../shared/geometry/wall.js";
import {
  renderFloor,
  renderPlanAnnotations,
  renderWallTops,
  roomTags,
  type Overlay,
} from "../../shared/render/plan.js";
import { C, PX_PER_MM, ROOM_LABEL } from "../../shared/render/style.js";
import type { View } from "../../shared/render/views.js";
import { idNodes } from "../../shared/schema/ids.js";
import type { BuildingModel, Storey } from "../../shared/schema/schema.js";
import type { ResolvedConstraint } from "../../shared/constraints/types.js";
import { constraintLabels } from "./constraints.js";
import { disposeTree } from "./dispose.js";
import { overlayGroup, type OverlayLayer } from "./overlay.js";
import { labelTexture, type BillboardLine } from "./text.js";
import { elementLabel, type ElementLabel } from "./identify.js";
import {
  SNAP_MAX_PX,
  axisAlignedPoint,
  isMeasureGesture,
  measurementLines,
  measurementSummary,
  measurementValues,
  nearestSnap,
  type MeasurementValues,
  type Point3,
  type SnapCandidate,
} from "../lib/measure.js";
import { diffModels, type DiffStatus, type ModelDiff } from "../../shared/diff/index.js";
import { styleOfColour } from "./style-of.js";
import {
  DIFF_COLOURS,
  diffFloor,
  doorSwings,
  floorChange,
  floorOutlines,
  floorPieces,
  recolourPlan,
  removedPlan,
  statusById,
  type StatusById,
} from "../lib/diff.js";
import {
  defaultName,
  groupModels,
  joinName,
  splitName,
  stepRevision as nextRevision,
  type ModelGroup,
} from "../lib/revisions.js";
import { cameraForView, cornerLabel, labelHeading, parseOrient, parseView, turnedTopFit } from "../lib/view.js";
import { WALK_AXES, entryPosition, headingBasis, movementOffset, walkRequested, walkStep } from "../lib/walk.js";
import type { ChangeCategory, ChangeGroup, ViewerStore } from "../state/store.js";
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

export interface ViewerApi {
  start(): Promise<void>;
  show(name: string, opts?: { keepView?: boolean }): Promise<void>;
  reloadModel(name: string): Promise<void>;
  chooseModel(model: string): Promise<void>;
  applyRevisionChoice(rev: string | null): Promise<void>;
  applyStoreyChoice(topId: string): Promise<void>;
  stepStorey(direction: 1 | -1): Promise<void>;
  stepRevision(direction: 1 | -1): Promise<void>;
  chooseView(view: View): Promise<void>;
  setLabels(on: boolean): void;
  toggleLabels(): void;
  setConstraints(on: boolean): void;
  toggleConstraints(): void;
  setIds(on: boolean): void;
  toggleIds(): void;
  setMeasuring(on: boolean): void;
  toggleMeasure(): Promise<void>;
  clearMeasurements(): void;
  toggleWalk(): Promise<void>;
  enterWalk(lock: boolean): Promise<void>;
  exitWalk(): Promise<void>;
  toggleDiff(): Promise<void>;
  setXray(on: boolean): Promise<void>;
  toggleXray(): Promise<void>;
  setChangeCategory(status: DiffStatus, on: boolean): Promise<void>;
  flyToChange(id: string, status: DiffStatus, storey: string): Promise<void>;
  onCompass(listener: (state: { visible: boolean; turn: number } | null) => void): () => void;
}

export async function createViewer(container: HTMLElement, store: ViewerStore): Promise<ViewerApi> {
  const params = new URLSearchParams(location.search);
  const snapshot = params.has("snapshot");
  /** The full shown name: `model` or `model@revision`. */
  let currentName = "";
  /** The shown base model, without a revision. */
  let currentBaseModel = "";
  const setStatus = (status: string) => store.set({ status });

  const components = new OBC.Components();
  const world = components.get(OBC.Worlds).create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = new THREE.Color(0xf4f4f2);
  world.renderer = new OBC.SimpleRenderer(components, container, {
    preserveDrawingBuffer: true,
  });
  world.renderer.showLogo = false;
  const canvas = world.renderer.three.domElement;
  world.camera = new OBC.OrthoPerspectiveCamera(components);
  components.init();
  setNavigationInput();
  world.camera.projection.onChanged.add(setNavigationInput);
  // A pinch spreading the fingers 4× should zoom about 4×; camera-controls' one dollySpeed also sets
  // the wheel's, so pick it per gesture. The container's capture listeners run before the canvas's.
  container.addEventListener(
    "pointerdown",
    (e) => (world.camera.controls.dollySpeed = e.pointerType === "touch" ? 1.5 : 1),
    { capture: true },
  );
  container.addEventListener("wheel", () => (world.camera.controls.dollySpeed = 1), { capture: true, passive: true });
  const grid = components.get(OBC.Grids).create(world);
  grid.config.color = new THREE.Color(0xd8d8d4);

  const fragments = components.get(OBC.FragmentsManager);
  fragments.init(workerUrl);
  world.camera.controls.addEventListener("update", () => fragments.core.update());
  fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
    // Avoid z-fighting where faces coincide (e.g. door panels inside wall openings).
    if (!("isLodMaterial" in material && material.isLodMaterial)) {
      material.polygonOffset = true;
      material.polygonOffsetUnits = 1;
      material.polygonOffsetFactor = 1;
    }
    // Fragments also creates materials after a model has loaded: a faded copy of each one for
    // Transparency's setOpacity, for example. Patch each as it arrives, or a faded stair shows the IFC's
    // safe green instead of its tread bands.
    if (material instanceof THREE.MeshLambertMaterial) patchMaterial(material);
  });

  const ifcLoader = components.get(OBC.IfcLoader);
  // Keep IFC coordinates as they are (no shift to the origin) so the room labels line up with the model.
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: { path: "/wasm/", absolute: true },
    webIfc: { COORDINATE_TO_ORIGIN: false },
  });

  /** Height (mm) above the ceiling at which the labels are laid, clear of the wall tops. */
  const LABEL_LIFT = 10;
  const labels = new THREE.Group();
  labels.visible = params.get("labels") === "1" || (!snapshot && params.get("labels") !== "0");
  world.scene.three.add(labels);

  /** Constraint labels and dotted spans, off until the Constraints button or `?constraints=1`. */
  const constraints = new THREE.Group();
  constraints.visible = params.get("constraints") === "1";
  world.scene.three.add(constraints);

  /** One completed measurement: its scene points and millimetre values. */
  interface Measurement {
    id: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    values: MeasurementValues;
  }

  /** Measurements, drawn above the model so a wall, floor or storey can never hide them. */
  const measureLayer = new THREE.Group();
  world.scene.three.add(measureLayer);
  const measureLineMaterial = new LineMaterial({
    color: C.measure,
    linewidth: 0.03,
    worldUnits: true,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const measureMarkerGeometry = new THREE.SphereGeometry(0.025, 12, 8);
  const measureMarkerMaterial = new THREE.MeshBasicMaterial({
    color: C.measure,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

  /** The loaded Fragments model, so a storey choice can update it without a reload. */
  let currentModel: FragmentsModel | null = null;

  /** The two view toggles, from `?diff=1` and `?xray=1`: Diff (revisions only) and Transparency. */
  const viewState = { diff: params.get("diff") === "1", xray: params.get("xray") === "1" };
  store.set({
    labels: labels.visible,
    constraints: constraints.visible,
    diff: viewState.diff,
    xray: viewState.xray,
  });
  /** Which diff categories the changes panel shows. */
  const shownCategories: Record<DiffStatus, boolean> = { added: true, changed: true, removed: true };
  /** Opacity of what Transparency fades. */
  const FADE = 0.35;
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** The shown revision's diff while Diff mode is on: its base, the diff, and each listed id's status. */
  let shownDiff: { baseName: string; base: BuildingModel; diff: ModelDiff; status: StatusById } | null = null;
  /** Each base model's JSON once fetched, for diffing its revisions. */
  const baseJson = new Map<string, BuildingModel | null>();
  /** The diff outlines, one group per storey so they hide with it. */
  const diffOutlines = new Map<string, THREE.Group>();
  /** The base model drawn as removed-element ghosts, while it is. */
  let ghostModel: FragmentsModel | null = null;
  /** Ghost item ids by storey, so the ghosts hide with their storey. */
  let ghostItems = new Map<string, number[]>();
  /** Model id per ghost item, for hover. */
  const ghostLabels = new Map<number, ElementLabel>();
  /** Status-line note for what Diff could not draw. */
  let diffNote = "";
  window.__elmsteadDiff = null;
  window.__elmsteadNote = "";
  window.__elmsteadOutlines = { added: 0, changed: 0, removed: 0 };
  window.__elmsteadGhosts = [];
  let loadEpoch = 0;
  let measureEpoch = 0;
  let measuring = false;
  const measureRequested = !snapshot && params.get("measure") === "1";
  let pendingPoint: THREE.Vector3 | null = null;
  let nextMeasurementId = 1;
  const measurements: Measurement[] = [];
  let queuedPick: { x: number; y: number } | null = null;
  let picking = false;
  let pointerCandidate: { id: number; x: number; y: number } | null = null;
  const measurePointers = new Set<number>();
  let pendingMarker: THREE.Mesh | null = null;
  window.__elmsteadMeasurements = [];

  /** True north, degrees counter-clockwise from plan +y (site.northAngle); null when there is no model JSON. */
  let northAngle: number | null = null;
  /** The lowest storey's elevation in scene metres, from the model JSON; null when there is none. */
  let lowestElevation: number | null = null;
  /** The model JSON beside the IFC; null when there is none. */
  let modelJson: BuildingModel | null = null;
  /** The storey ids `?storeys=` asked for, in the model's order; null means every storey. */
  let shownStoreys: string[] | null = null;
  /** The label and plan-layer groups drawn for each storey, so hiding it takes its drawings with it. */
  const storeyLayers = new Map<string, THREE.Group[]>();

  /** Whether a storey is shown: the `?storeys=` selection, or every storey when it is absent. */
  const isShown = (id: string): boolean => shownStoreys === null || shownStoreys.includes(id);
  type CompassState = { visible: boolean; turn: number };
  const compassListeners = new Set<(state: CompassState | null) => void>();
  const emitCompass = (state: CompassState | null) => {
    for (const listener of compassListeners) listener(state);
  };

  /**
   * Turn the compass so its arrow lies along true north as it appears on screen: project a line
   * pointing north from the middle of the ground, so perspective views read the same as the ground.
   */
  function updateCompass() {
    if (!labels.visible || northAngle === null) {
      emitCompass(null);
      return;
    }
    const a = (northAngle! * Math.PI) / 180;
    const centre = shownBox().getCenter(new THREE.Vector3()).setY(box.min.y);
    // Plan north (−sin a, cos a) in IFC x/y; the scene has IFC +y along −Z.
    const tip = centre.clone().add(new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)));
    const camera = world.camera.three;
    const [p, q] = [centre.project(camera), tip.project(camera)];
    const { clientWidth: w, clientHeight: h } = world.renderer!.three.domElement;
    const dx = ((q.x - p.x) * w) / 2;
    const dy = (-(q.y - p.y) * h) / 2;
    if (Math.hypot(dx, dy) < 1e-6) {
      emitCompass(null);
      return;
    }
    emitCompass({ visible: true, turn: Math.atan2(dx, -dy) }); // clockwise from screen up
  }
  world.camera.controls.addEventListener("update", updateCompass);
  world.camera.controls.addEventListener("update", updateLabelOrientation);
  // A moving camera leaves any hover label naming the wrong element. Hide while it moves, then
  // re-pick once the updates settle: a trailing update would otherwise hide a pick made at load end.
  let hoverRepickTimer = 0;
  world.camera.controls.addEventListener("update", () => {
    hideHover();
    clearTimeout(hoverRepickTimer);
    hoverRepickTimer = window.setTimeout(repickHover, 120);
  });
  window.addEventListener("resize", updateCompass);

  /** A sprite that always faces the camera, at the plan's text scale, with a halo so it reads over the model. */
  function billboard(lines: BillboardLine[], fill: string, renderOrder: number, depthTest = false): THREE.Sprite {
    const { map, width, height } = labelTexture(lines, fill);
    // Constraints and measurements depth-test, so a wall or a storey above hides them.
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest, depthWrite: false }));
    sprite.renderOrder = renderOrder;
    const mPerPx = 1 / PX_PER_MM / 1000;
    sprite.scale.set(width * mPerPx, height * mPerPx, 1);
    return sprite;
  }

  /** Lays a flat label's texture up along plan north, on the floor plane before any heading yaw. */
  const FLAT_LABEL_BASE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const labelYaw = new THREE.Quaternion();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  /** Every flat label, so orienting them on a camera update need not traverse the whole label tree. */
  const flatLabels: THREE.Mesh[] = [];

  /**
   * A label lying flat on a ceiling, at the plan's text scale, so an upper storey's floor can hide
   * it. `updateLabelOrientation` yaws it about its anchor so it reads across the screen.
   */
  function flatLabel(lines: BillboardLine[], fill: string, renderOrder: number): THREE.Mesh {
    const { map, width, height } = labelTexture(lines, fill);
    map.anisotropy = world.renderer!.three.capabilities.getMaxAnisotropy();
    const mPerPx = 1 / PX_PER_MM / 1000;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width * mPerPx, height * mPerPx),
      new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
    );
    mesh.quaternion.copy(FLAT_LABEL_BASE);
    mesh.renderOrder = renderOrder;
    flatLabels.push(mesh);
    return mesh;
  }

  /** Turn every flat room label within its plane so its text reads left-to-right from the camera. */
  function updateLabelOrientation() {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(world.camera.three.quaternion);
    labelYaw.setFromAxisAngle(WORLD_UP, labelHeading(right));
    for (const label of flatLabels) label.quaternion.copy(labelYaw).multiply(FLAT_LABEL_BASE);
  }

  /** Constraint labels draw above everything, including their dotted spans. */
  function constraintBillboard(lines: string[]): THREE.Sprite {
    const step = 14;
    return billboard(
      lines.map((text, i) => ({ text, size: 11, bold: true, dy: (i - (lines.length - 1) / 2) * step })),
      C.constraint,
      7,
      true,
    );
  }

  /** Red dotted spans: 4 cm wide in world units, at their storey's ceiling, occluded like its labels. */
  const constraintLineMaterial = new LineMaterial({
    color: C.constraint,
    linewidth: 0.04,
    worldUnits: true,
    dashed: true,
    dashSize: 0.15,
    gapSize: 0.1,
    depthWrite: false,
    transparent: true,
  });

  /** A red dotted span between two plan points, at scene height `y`, drawn over the model. */
  function constraintLine(from: { x: number; y: number }, to: { x: number; y: number }, y: number): Line2 {
    const geometry = new LineGeometry();
    geometry.setPositions([from.x / 1000, y, -from.y / 1000, to.x / 1000, y, -to.y / 1000]);
    const line = new Line2(geometry, constraintLineMaterial);
    line.computeLineDistances();
    line.frustumCulled = false; // a flat line's bounding sphere can miss the camera
    line.renderOrder = 6; // over the model, room labels and dimensions; under the red labels
    return line;
  }

  /** A storey's overlay drawing as flat scene geometry at height `y` (m), the drawing's north along −Z (IFC +Y). */
  const planGeometry = ({ nodes, bounds }: Overlay, y: number, layer: OverlayLayer) =>
    overlayGroup(nodes, bounds, y, layer, world.renderer!.three.capabilities.getMaxAnisotropy());

  /**
   * Plan colouring's layers (see applyStyle): the plan's floor fills (slab and rooms) and door swings
   * standing in for the slab's top face, and the plan's walls, door gaps and windows laid over the
   * wall tops.
   */
  const planLayers = new THREE.Group();
  planLayers.visible = false;
  world.scene.three.add(planLayers);
  /** Height (mm) above the wall tops of the plan's walls, door gaps and windows; below the labels. */
  const WALL_TOP_LIFT = 5;
  /**
   * Height (mm) a storey's floor plane sits above its own elevation. The storey below draws its wall
   * tops 5 mm and its labels 10 mm above its ceiling, which is this storey's elevation, so a floor
   * plane at exactly the elevation would pass beneath them and they would show through it.
   */
  const FLOOR_LIFT = LABEL_LIFT + 10;

  /** Walk mode stands on the lowest storey the selection still shows. */
  function updateLowestElevation() {
    if (!modelJson) return;
    const shown = modelJson.storeys.filter((s) => isShown(s.id));
    const lowest = (shown.length ? shown : modelJson.storeys).reduce((a, b) => (b.elevation < a.elevation ? b : a));
    lowestElevation = lowest.elevation / 1000; // the JSON is millimetres, the scene metres
  }

  /**
   * The plan's dimensions for each storey drawn flat at its ceiling, each room's
   * name and area on its own flat label there, and that storey's constraints as red labels and
   * dotted spans beside them. The schema has no ceiling height, so the ceiling is the top of the
   * storey's tallest wall. Lying flat, an upper storey's floor occludes a lower storey's labels, as
   * it does its rooms; the room labels yaw with the camera to stay readable.
   */
  async function loadLabels(name: string, model: BuildingModel | null, epoch: number) {
    if (epoch !== loadEpoch) return;
    clearLabelLayers();
    northAngle = null;
    lowestElevation = null;
    modelJson = model;
    window.__elmsteadRoomLabels = [];
    if (!model) return publishViewLabels(); // no JSON next to the IFC: show the IFC without labels
    northAngle = model.site.northAngle ?? 0;
    publishViewLabels();
    const constraintsRes = await fetch(`/out/${name}.constraints.json`);
    if (epoch !== loadEpoch) return;
    const resolved = constraintsRes.ok ? ((await constraintsRes.json()) as ResolvedConstraint[]) : [];
    updateLowestElevation();
    for (const storey of model.storeys) {
      const [labelGroup, layerGroup, constraintGroup] = buildStoreyLayers(storey, model, resolved);
      labels.add(labelGroup);
      planLayers.add(layerGroup);
      constraints.add(constraintGroup);
      storeyLayers.set(storey.id, [labelGroup, layerGroup, constraintGroup]);
    }
    updateLabelOrientation();
  }

  /** Frees and empties the label, constraint and plan layers, ready for the next model. */
  function clearLabelLayers() {
    const shared = new Set([constraintLineMaterial]); // every constraint line shares one material
    for (const obj of [...labels.children, ...constraints.children, ...planLayers.children]) disposeTree(obj, shared);
    labels.clear();
    constraints.clear();
    planLayers.clear();
    storeyLayers.clear();
    flatLabels.length = 0;
  }

  /**
   * One storey's labels (dimensions and room tags at its ceiling), plan layers (wall tops and floor)
   * and constraints, each in its own group and shown or hidden with the storey.
   */
  function buildStoreyLayers(
    storey: Storey,
    model: BuildingModel,
    resolved: readonly ResolvedConstraint[],
  ): [THREE.Group, THREE.Group, THREE.Group] {
    // Dimensions lying flat at the ceiling: lying flat is what lets an upper storey's floor occlude
    // them, which a camera-facing billboard could never be. Over the wall tops' layer.
    const ceiling = Math.max(0, ...storey.walls.map((w) => wallHeight(w)));
    const y = (storey.elevation + ceiling + LABEL_LIFT) / 1000;
    const labelGroup = new THREE.Group();
    labelGroup.add(
      planGeometry(renderPlanAnnotations(storey, { names: false }), y, { kind: "overlay", renderOrder: 1 }),
    );
    for (const label of roomLabels(storey, y)) labelGroup.add(label);
    const layerGroup = new THREE.Group();
    for (const tops of wallTopOverlays(storey, model)) layerGroup.add(tops);
    // Every storey's floor is its own slab and room fills, at its own level, writing depth: the floor you
    // see is the topmost one, and it hides the storeys below. Opaque, not blended, so it stays in the
    // opaque pass that runs before the walls. Built even while hidden, so the selector can show a
    // storey again without rebuilding it.
    const floor = renderFloor(storey, model.components);
    layerGroup.add(planGeometry(floor, (storey.elevation + FLOOR_LIFT) / 1000, { kind: "floor", renderOrder: -1 }));
    for (const layer of diffPlanLayers(storey, floor)) layerGroup.add(layer);
    // Constraints live in their own per-storey group inside the constraints layer, so the
    // Constraints button and the storey selection compose.
    const constraintGroup = new THREE.Group();
    for (const label of constraintLabels(resolved, storey.id)) {
      const sprite = constraintBillboard(label.lines);
      sprite.position.set(label.at.x / 1000, y, -label.at.y / 1000);
      constraintGroup.add(sprite);
    }
    for (const c of resolved) {
      if (c.storey === storey.id) constraintGroup.add(constraintLine(c.span.from, c.span.to, y));
    }
    const groups: [THREE.Group, THREE.Group, THREE.Group] = [labelGroup, layerGroup, constraintGroup];
    for (const g of groups) g.visible = isShown(storey.id);
    return groups;
  }

  /**
   * Each room's name and area as its own plane at height `y`, flat like the dimensions but yawed to
   * the camera (updateLabelOrientation), so it stays occludable without standing up through the
   * floor above. Also records each label for the test hook.
   */
  function roomLabels(storey: Storey, y: number): THREE.Mesh[] {
    return roomTags(storey).map((tag) => {
      window.__elmsteadRoomLabels!.push([tag.name, tag.area, tag.id]);
      const label = flatLabel(
        [
          { text: tag.name, size: ROOM_LABEL.name.size, bold: true, dy: ROOM_LABEL.name.dy },
          { text: tag.area, size: ROOM_LABEL.area.size, dy: ROOM_LABEL.area.dy },
          { text: tag.id, size: 9, dy: ROOM_LABEL.area.dy + 12 },
        ],
        C.ink,
        2, // over the dimension lines, as the room billboards were
      );
      label.position.set(tag.at.x / 1000, y, -tag.at.y / 1000);
      return label;
    });
  }

  /**
   * The wall-top poché, which lies flat, so it only fits flat-topped walls; a pitched wall's sloped
   * top is painted by patchTops instead. One overlay per flat-wall height, each at its own wall top,
   * so a taller wall's plane never floats above a shorter one (e.g. the first floor's 2.7 m walls
   * over its 2.55 m bay).
   */
  function wallTopOverlays(storey: Storey, model: BuildingModel): THREE.Object3D[] {
    const byHeight = new Map<number, Storey["walls"]>();
    for (const w of storey.walls.filter((wall) => !wall.profile)) {
      const h = wallHeight(w);
      const group = byHeight.get(h);
      if (group) group.push(w);
      else byHeight.set(h, [w]);
    }
    return [...byHeight].map(([h, walls]) => {
      const ids = new Set(walls.map((w) => w.id));
      const groupStorey = { ...storey, walls, openings: storey.openings.filter((o) => ids.has(o.wallId)) };
      const tops = renderWallTops(groupStorey, model.components);
      return planGeometry(
        shownDiff ? recolourPlan(tops, shownDiff.status) : tops,
        (storey.elevation + h + WALL_TOP_LIFT) / 1000,
        { kind: "overlay", renderOrder: 0 },
      );
    });
  }

  /**
   * The diff's own plan layers for a storey, while Diff mode is on: the floor built and taken away,
   * 1 mm above the floor (coplanar fills in one floor layer do not reliably stack in drawing order: a
   * room fill can lose to the slab fill under it), the door swings and the added and changed slab
   * and room outlines above them, and what the
   * revision removed, from the base, 2 mm above its wall tops so a bricked-up window shows over the
   * wall that now runs through it.
   */
  function diffPlanLayers(storey: Storey, floor: Overlay): THREE.Object3D[] {
    if (!shownDiff) return [];
    const { status, base } = shownDiff;
    const out: THREE.Object3D[] = [];
    const was = base.storeys.find((s) => s.id === storey.id);
    // The floor built and taken away, drawn as rooms of this storey so they share its plan's scale;
    // its own rooms and slabs only as outlines, so floor that just changed room has no tint.
    const pieces = was ? floorPieces(floorChange(was, storey)) : [];
    const fills = pieces.length ? diffFloor(renderFloor({ ...storey, slabs: [], rooms: pieces, openings: [] })) : null;
    if (fills)
      out.push(planGeometry(fills, (storey.elevation + FLOOR_LIFT + 1) / 1000, { kind: "floor", renderOrder: -1 }));
    const outlines = floorOutlines(floor, status);
    if (fills || outlines)
      out.push(
        planGeometry(doorSwings(floor), (storey.elevation + FLOOR_LIFT + 2) / 1000, {
          kind: "overlay",
          renderOrder: -1,
        }),
      );
    if (outlines)
      out.push(
        planGeometry(outlines, (storey.elevation + FLOOR_LIFT + 2) / 1000, { kind: "overlay", renderOrder: -1 }),
      );
    if (was) {
      const removed = (id: string) => status.get(id) === "removed";
      const walls = was.walls.filter(
        (w) => !w.profile && (removed(w.id) || was.openings.some((o) => o.wallId === w.id && removed(o.id))),
      );
      if (walls.length) {
        const hosts = new Set(walls.map((w) => w.id));
        const drawn = removedPlan(
          renderWallTops({ ...was, walls, openings: was.openings.filter((o) => hosts.has(o.wallId)) }, base.components),
          status,
        );
        const h = Math.max(...walls.map((w) => wallHeight(w)));
        if (drawn)
          out.push(
            planGeometry(drawn, (storey.elevation + h + WALL_TOP_LIFT + 2) / 1000, { kind: "overlay", renderOrder: 0 }),
          );
      }
    }
    return out;
  }

  let box = new THREE.Box3();

  /** Note for the status line, set when `?storeys=` names ids the model does not have. */
  let storeysNote = "";

  /** Read `?storeys=` against the model's storeys; unknown ids fall back to showing everything. */
  function parseStoreysParam(model: BuildingModel | null) {
    shownStoreys = null;
    storeysNote = "";
    const raw = params.get("storeys");
    if (!model || !raw) return;
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const known = ids.filter((id) => model.storeys.some((s) => s.id === id));
    const unknown = ids.filter((id) => !known.includes(id));
    shownStoreys = known.length ? known : null;
    if (unknown.length) storeysNote = ` · no storey ${unknown.map((u) => `"${u}"`).join(", ")}, showing all`;
  }

  /** The model's storeys, lowest first: the selector's order and a cumulative choice's order. */
  const storeysLowestFirst = (model: BuildingModel): Storey[] =>
    [...model.storeys].sort((a, b) => a.elevation - b.elevation);

  /** Whether `ids` is every storey up to one floor: the shape the selector writes to `?storeys=`. */
  function isStoreyPrefix(ids: string[], ordered: Storey[]): boolean {
    const selected = new Set(ids);
    return ordered.every((s, i) => selected.has(s.id) === i < ids.length);
  }

  /** Fill the selector's store state, showing the floor the selection reaches or a custom value. */
  function populateStoreySelector(model: BuildingModel | null) {
    const ordered = model ? storeysLowestFirst(model) : [];
    const show = ordered.length > 1;
    if (!show) {
      store.set({ storeys: [], storeyLabelHidden: true, storeyValue: "", storeyCustom: false });
      return;
    }
    const options = ordered.map((s) => ({ value: s.id, text: s.name }));
    let top = "";
    let custom = false;
    if (shownStoreys !== null && !isStoreyPrefix(shownStoreys, ordered)) {
      // The URL asked for a set no single floor describes; say so until a floor is chosen.
      custom = true;
    } else {
      const shown = new Set(shownStoreys ?? ordered.map((s) => s.id));
      top = ([...ordered].reverse().find((s) => shown.has(s.id)) ?? ordered[ordered.length - 1]!).id;
    }
    store.set({ storeys: options, storeyLabelHidden: false, storeyValue: top, storeyCustom: custom });
  }

  /** Apply the selector: show `topId` and every storey below it, hiding everything above. */
  async function chooseStorey(topId: string): Promise<void> {
    if (!modelJson || !currentModel || !topId) return;
    const ordered = storeysLowestFirst(modelJson);
    const end = ordered.findIndex((s) => s.id === topId);
    if (end < 0) return;
    const ids = ordered.slice(0, end + 1).map((s) => s.id);
    shownStoreys = ids.length === ordered.length ? null : ids;
    storeysNote = "";
    if (shownStoreys === null) params.delete("storeys");
    else params.set("storeys", shownStoreys.join(","));
    history.replaceState(null, "", `?${params}`);
    populateStoreySelector(modelJson);
    await applyStoreyVisibility(currentModel, true);
    // A later choice may have taken over while this one animated; that choice owns the finishing work.
    const shown = new Set(shownStoreys ?? ordered.map((s) => s.id));
    const latestTop = [...ordered].reverse().find((s) => shown.has(s.id))?.id;
    if (topId !== latestTop) return;
    updateLowestElevation();
    setStatus(`${currentName}.ifc`);
    // The camera stays put: only the drawings change, so floors compare from one viewpoint.
    await fragments.core.update(true);
    updateCompass();
    repickHover();
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
   * The section plane a floor change sweeps: it clips everything above its height. The renderer
   * holds this one array by reference, so moving the plane is picked up in place.
   */
  const sweepPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), SWEEP_PARKED);
  const sweepPlanes: THREE.Plane[] = [sweepPlane];
  world.renderer.three.clippingPlanes = sweepPlanes;

  /** Each storey's items, read once per loaded model so a sweep need not walk the model again. */
  let storeyItemCache: { modelId: string; byStorey: Map<string, number[]> } | null = null;

  /** The storeys last fully shown; null until the first model's storeys have been applied. */
  let settledStoreys: Set<string> | null = null;

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
  interface StoreyMotion {
    model: FragmentsModel;
    entries: Map<string, StoreyMotionEntry>;
    target: Set<string>;
    plane: number;
    targetPlane: number;
    running: boolean;
    waiters: (() => void)[];
  }

  let storeyMotion: StoreyMotion | null = null;
  /** Retargets run in order, so two quick choices cannot both create the same storey's entry. */
  let storeyChain: Promise<void> = Promise.resolve();

  /**
   * The height (scene m) any of a storey's elements reaches. A storey with no walls, such as the
   * street level, is topped by its railings; a stair climbs to the storey above.
   */
  function storeyTop(storey: Storey, byId: Map<string, Storey>): number {
    let top = storey.elevation + Math.max(0, ...storey.walls.map((w) => wallHeight(w)));
    for (const o of storey.openings) top = Math.max(top, storey.elevation + o.sillHeight + o.height);
    for (const slab of storey.slabs) top = Math.max(top, storey.elevation + slab.elevationOffset);
    for (const r of storey.railings ?? [])
      top = Math.max(top, storey.elevation + Math.max(r.startBase ?? 0, r.endBase ?? 0) + r.height);
    for (const st of storey.stairs ?? []) top = Math.max(top, byId.get(st.toStoreyId)?.elevation ?? storey.elevation);
    return top / 1000;
  }

  /**
   * A sweep height that keeps a floor's drawings: clear of its wall tops and labels. The next
   * storey's floor structure starts just above it, so a thin sliver can show at the cut.
   */
  const SWEEP_MARGIN = (LABEL_LIFT + 2) / 1000;

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
          if (m === constraintLineMaterial || seen.has(m)) continue;
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
    if (storeyItemCache?.modelId === model.modelId) return storeyItemCache.byStorey;
    const byStorey = new Map<string, number[]>();
    if (!modelJson) return byStorey;
    const owner = new Map<string, string>();
    for (const s of modelJson.storeys) {
      for (const w of s.walls) owner.set(w.id, s.id);
      for (const o of s.openings) owner.set(o.id, s.id);
      for (const sl of s.slabs) owner.set(sl.id, s.id);
      for (const r of s.rooms) owner.set(r.id, s.id);
      for (const st of s.stairs ?? []) {
        owner.set(st.id, s.id);
        for (const seg of st.segments) owner.set(seg.id, s.id);
      }
      for (const r of s.railings ?? []) owner.set(r.id, s.id);
    }
    // Fragments' spatial tree does not surface every storey, so map items by their Tag (elements) or
    // Name (spaces, whose Tag the writer leaves empty) instead of walking it.
    for (const [localId, item] of await model.getItems()) {
      const key = (item.data.Tag?.value ?? item.data.Name?.value) as string | undefined;
      const storey = key ? owner.get(key) : undefined;
      if (!storey) continue;
      byStorey.set(storey, [...(byStorey.get(storey) ?? []), localId]);
    }
    storeyItemCache = { modelId: model.modelId, byStorey };
    return byStorey;
  }

  /** Finish a floor change at once: every transitioning storey at its target, the plane parked. */
  async function finishStoreyMotionNow(): Promise<void> {
    const motion = storeyMotion;
    if (!motion) return;
    storeyMotion = null;
    for (const entry of motion.entries.values()) {
      if (entry.target > 0) {
        if (entry.items.length) {
          if (entry.rest === 1) await motion.model.resetOpacity(entry.items);
          else await motion.model.setOpacity(entry.items, entry.rest);
        }
        if (entry.layers) endLayerFade(entry.layers);
      } else {
        if (entry.items.length) {
          await motion.model.setVisible(entry.items, false);
          await motion.model.resetOpacity(entry.items);
        }
        if (entry.layers) endLayerFade(entry.layers);
        for (const group of entry.groups) group.visible = false;
      }
    }
    await fragments.core.update(true);
    sweepPlane.constant = SWEEP_PARKED;
    settledStoreys = new Set(motion.target);
    await fragments.core.update(true);
    for (const resolve of motion.waiters.splice(0)) resolve();
  }

  /** Finish any floor change at once, queued behind a retarget already in flight. */
  function finishStoreyMotion(): Promise<void> {
    storeyChain = storeyChain.then(finishStoreyMotionNow);
    return storeyChain;
  }

  /** Resolves once the running floor change has settled, even if another target arrives first. */
  function storeyMotionSettled(): Promise<void> {
    const motion = storeyMotion;
    if (!motion) return Promise.resolve();
    return new Promise((resolve) => motion.waiters.push(resolve));
  }

  /**
   * The opacity a shown storey rests at. Transparency fades every element, so entering and leaving
   * storeys sweep between 0 and that opacity rather than 0 and 1.
   */
  function storeyRestOpacity(): number {
    return viewState.xray ? FADE : 1;
  }

  /** Hide and restore each storey the motion has finished with; park the plane when none is left. */
  async function settleStoreyMotion(motion: StoreyMotion): Promise<void> {
    if (storeyMotion !== motion) return;
    for (const [id, entry] of [...motion.entries]) {
      if (entry.target === 0 && entry.opacity === 0) {
        if (entry.items.length) {
          await motion.model.setVisible(entry.items, false);
          await motion.model.resetOpacity(entry.items);
        }
        if (entry.layers) endLayerFade(entry.layers);
        for (const group of entry.groups) group.visible = false;
        motion.entries.delete(id);
      } else if (entry.target > 0 && entry.opacity === entry.target) {
        if (entry.items.length) {
          if (entry.rest === 1) await motion.model.resetOpacity(entry.items);
          else await motion.model.setOpacity(entry.items, entry.rest);
        }
        if (entry.layers) endLayerFade(entry.layers);
        entry.layers = null;
        motion.entries.delete(id);
      }
    }
    if (storeyMotion !== motion) return;
    if (motion.entries.size > 0) {
      startStoreyMotion(motion);
      return;
    }
    // Flush at the clipped state before parking, so the last frame cannot show stale geometry.
    await fragments.core.update(true);
    sweepPlane.constant = SWEEP_PARKED;
    settledStoreys = new Set(motion.target);
    storeyMotion = null;
    await fragments.core.update(true);
    for (const resolve of motion.waiters.splice(0)) resolve();
  }

  /** Ease every transitioning storey and the plane toward its target; settle when all arrive. */
  function startStoreyMotion(motion: StoreyMotion): void {
    if (motion.running) return;
    motion.running = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (storeyMotion !== motion) return;
      const dt = Math.min(64, Math.max(0, now - last));
      last = now;
      const k = 1 - Math.exp(-dt / STOREY_TAU_MS);
      motion.plane += (motion.targetPlane - motion.plane) * k;
      if (Math.abs(motion.targetPlane - motion.plane) < 0.0005) motion.plane = motion.targetPlane;
      sweepPlane.constant = motion.plane;
      let moving = motion.plane !== motion.targetPlane;
      for (const entry of motion.entries.values()) {
        entry.opacity += (entry.target - entry.opacity) * k;
        if (Math.abs(entry.target - entry.opacity) < 0.01) entry.opacity = entry.target;
        if (entry.layers) applyLayerFade(entry.layers, entry.opacity / entry.rest);
        if (entry.items.length) void motion.model.setOpacity(entry.items, entry.opacity);
        if (entry.opacity !== entry.target) moving = true;
      }
      fragments.core.update();
      if (moving) {
        requestAnimationFrame(tick);
        return;
      }
      motion.running = false;
      storeyChain = storeyChain.then(() => settleStoreyMotion(motion));
    };
    requestAnimationFrame(tick);
  }

  /** Point the running floor change at `target`, creating or flipping storeys as needed. */
  function retargetStoreyMotion(model: FragmentsModel, ordered: Storey[], target: Set<string>): Promise<void> {
    storeyChain = storeyChain.then(async () => {
      const byStorey = await storeyItemsOf(model);
      const byId = new Map(modelJson!.storeys.map((s) => [s.id, s]));
      const highest = (list: Storey[]) => (list.length ? Math.max(...list.map((s) => storeyTop(s, byId))) : 0);
      const rest = storeyRestOpacity();
      if (!storeyMotion || storeyMotion.model !== model) {
        await finishStoreyMotionNow();
        const shown = settledStoreys ?? new Set(ordered.map((s) => s.id));
        const plane = highest(ordered.filter((s) => shown.has(s.id))) + SWEEP_MARGIN;
        sweepPlane.constant = plane;
        storeyMotion = {
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
        storeyMotion.target = target;
        storeyMotion.targetPlane = highest(ordered.filter((s) => target.has(s.id))) + SWEEP_MARGIN;
      }
      const motion = storeyMotion;
      const shown = settledStoreys ?? new Set(ordered.map((s) => s.id));
      for (const storey of ordered) {
        const entry = motion.entries.get(storey.id);
        const inTarget = target.has(storey.id);
        if (entry) {
          entry.target = inTarget ? entry.rest : 0;
          if (!inTarget && !entry.layers) entry.layers = beginLayerFade(entry.groups);
          continue;
        }
        const wasShown = shown.has(storey.id);
        if (inTarget === wasShown) continue;
        const groups = storeyLayers.get(storey.id) ?? [];
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
          motion.entries.set(storey.id, { id: storey.id, items, groups, layers, opacity: 0, rest, target: rest });
        } else {
          applyLayerFade(layers, 1);
          motion.entries.set(storey.id, { id: storey.id, items, groups, layers, opacity: rest, rest, target: 0 });
        }
      }
      startStoreyMotion(motion);
    });
    return storeyChain;
  }

  /**
   * Show exactly the selected storeys through fragments: each item is visible when the storey its Tag
   * — or its Name, for spaces — belongs to is. Items that name no model element are left alone; they
   * carry no geometry. Storey layers follow the same selection, so labels, floors and constraints
   * travel with their storey. A floor choice sweeps a section plane between the two floor levels,
   * fading the storeys at Transparency's opacity when it is on; snapshots, Diff and reduced motion
   * apply the choice at once, as does a model's first application.
   */
  async function applyStoreyVisibility(model: FragmentsModel, animate = false) {
    if (!modelJson) return;
    const ordered = storeysLowestFirst(modelJson);
    const target = new Set(ordered.filter((s) => isShown(s.id)).map((s) => s.id));
    const sweepNow = animate && !snapshot && !viewState.diff && !prefersReducedMotion();
    if (!sweepNow) {
      await finishStoreyMotion();
      for (const [storey, ids] of await storeyItemsOf(model)) await model.setVisible(ids, isShown(storey));
      for (const [id, groups] of storeyLayers) for (const g of groups) g.visible = isShown(id);
      for (const [id, group] of diffOutlines) group.visible = isShown(id);
      if (ghostModel) for (const [id, ids] of ghostItems) await ghostModel.setVisible(ids, isShown(id));
      settledStoreys = target;
      publishChanges();
      return;
    }
    if (
      !storeyMotion &&
      settledStoreys &&
      target.size === settledStoreys.size &&
      [...target].every((id) => settledStoreys!.has(id))
    ) {
      publishChanges();
      return;
    }
    await retargetStoreyMotion(model, ordered, target);
    publishChanges();
    await storeyMotionSettled();
  }

  /** Bounding box of the shown storeys' plan geometry, so the walk pose centres on what is visible.
   * The compass asks for it on every camera update, so it is cached until the model, the selection
   * or the fallback box changes. Callers only read it (getCenter/clone). */
  let shownBoxCache: {
    model: BuildingModel | null;
    storeys: string[] | null;
    fallback: THREE.Box3;
    result: THREE.Box3;
  } | null = null;
  function shownBox(): THREE.Box3 {
    const c = shownBoxCache;
    if (c && c.model === modelJson && c.storeys === shownStoreys && c.fallback === box) return c.result;
    const result = computeShownBox();
    shownBoxCache = { model: modelJson, storeys: shownStoreys, fallback: box, result };
    return result;
  }
  function computeShownBox(): THREE.Box3 {
    if (!modelJson) return box;
    const pts = modelJson.storeys
      .filter((s) => isShown(s.id))
      .flatMap((s) => [
        ...s.walls.flatMap((w) => [w.start, w.end]),
        ...s.slabs.flatMap((sl) => sl.outline),
        ...s.rooms.flatMap((r) => r.outline),
        ...(s.railings ?? []).flatMap((r) => [r.start, r.end]),
      ]);
    if (!pts.length) return box;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return new THREE.Box3(
      new THREE.Vector3(Math.min(...xs) / 1000, 0, -Math.max(...ys) / 1000),
      new THREE.Vector3(Math.max(...xs) / 1000, 1, -Math.min(...ys) / 1000),
    );
  }

  /**
   * Plan colouring, in every view except snapshots (which show the IFC's own colours):
   *
   * - Floors: the slab's top face is not drawn; the plan's own floor fills (slab and rooms) and door
   *   swings are drawn first, without depth, so the model always covers them. (A wall's underside lies exactly on the slab's top
   *   face, and on real GPUs the two fight for depth.) The slab's edges still show.
   * - Walls keep their IFC colour and lighting, except faces that look upwards (wall tops, window
   *   sills), which are the plan's charcoal, unlit. A small shader patch picks those out by their
   *   world-space normal, so the material itself is unchanged.
   * - The plan's walls, door gaps and windows are laid just above the wall tops, so looking down
   *   shows what is in the walls below (open door gaps, window symbols) as the plan does.
   * - White background, no grid.
   */
  type Style = "ifc" | "plan";
  /** ?orient=project keeps the views on plan axes, for the plan-versus-3D comparison; otherwise they follow true north. */
  const orient = parseOrient(params.get("orient"));
  const styleParam = params.get("style"); // ?style=ifc|plan overrides the default
  const style: Style = styleParam === "ifc" || styleParam === "plan" ? styleParam : snapshot ? "ifc" : "plan";

  /** Which of the IFC's presentation colours (src/shared/ifc/styles.ts) a material carries, if any. */
  const styleOf = (material: THREE.MeshLambertMaterial): keyof typeof STYLES | undefined =>
    styleOfColour(material.color);

  const wallTop = new THREE.Color(C.wall); // linear, as the shader works in linear

  /**
   * Patch a material for plan style. `mode` 1 paints upward faces in the plan's wall colour; `mode` 2
   * keeps only downward faces, so a slab contributes its underside — the ceiling of the storey below —
   * and nothing else: no grey top over the room fills, and no grey edges floating on the facade.
   */
  function patchTops(m: THREE.MeshLambertMaterial, mode: 1 | 2) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.planTopColour = { value: wallTop };
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform vec3 planTopColour;\nvoid main() {")
        // `normal` is view-space; `normal * mat3(viewMatrix)` is the world-space normal (the view
        // matrix is orthonormal). It is only defined by the time the opaque fragment runs.
        .replace(
          "#include <opaque_fragment>",
          `float planTopNy = (normal * mat3(viewMatrix)).y;
        ${mode === 1 ? "if (planTopNy > 0.7) { outgoingLight = planTopColour; }" : "if (planTopNy > 0.7) discard;"}
        #include <opaque_fragment>`,
        );
    };
    m.customProgramCacheKey = () => `elmstead-plan-top-${mode}`;
    m.needsUpdate = true;
  }

  /** Apply plan colouring to the model's materials once it has loaded (see `style`). */
  /** The viewer's presentation on one material, by the IFC colour it carries: plan-style tops, stair bands. */
  function patchMaterial(m: THREE.MeshLambertMaterial) {
    const name = styleOf(m);
    if (style === "plan" && name === "wall") patchTops(m, 1);
    if (style === "plan" && (name === "slab" || name === "ground")) patchTops(m, 2);
    if (name === "stair") patchStairBands(m);
  }

  function applyStyle() {
    const plan = style === "plan";
    for (const m of fragments.core.models.materials.list.values())
      if (m instanceof THREE.MeshLambertMaterial) patchMaterial(m);
    applyStairPresentation();
    world.scene.three.background = new THREE.Color(plan ? C.paper : 0xf4f4f2);
    grid.three.visible = !plan;
    planLayers.visible = plan;
  }

  /**
   * Stair readability presentation, applied in every viewer mode including snapshots (the ifc-viewer
   * spec allows the stair recolour in snapshots so the steps read there too).
   *
   * From straight down a flight's tread tops are uniformly lit and its risers are edge-on, so the steps
   * read as a flat slab. Banding the upward faces by floor(worldY / riser) alternates the floor cream
   * with a darker cream (tread tops are integer multiples of the stair's riser); vertical faces take the
   * wall colour; an EdgesGeometry outline reads the nosings from corner views. All stairs share one
   * riser, taken from the stair with the largest riser, because Fragments renders them under one
   * material; a model whose stairs differ bands them all on that riser (see ifc-viewer). The material stays the
   * safe stair green so the viewer's classifier leaves it alone; only the shaded output is recoloured.
   */
  const stairEdgeMaterial = new THREE.LineBasicMaterial({ color: C.ink });
  const stairCream = new THREE.Color(C.room);
  const stairCreamDark = stairCream.clone().multiplyScalar(0.8);
  const stairWall = new THREE.Color().setRGB(
    STYLES.wall.rgb[0],
    STYLES.wall.rgb[1],
    STYLES.wall.rgb[2],
    THREE.SRGBColorSpace,
  );
  let stairRiser = 0; // metres, set from the model on load
  function patchStairBands(m: THREE.MeshLambertMaterial) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRiser = { value: stairRiser };
      shader.uniforms.uCream = { value: stairCream };
      shader.uniforms.uCreamDark = { value: stairCreamDark };
      shader.uniforms.uWall = { value: stairWall };
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying float vWorldY;\nvarying vec3 vWorldN;\nvoid main() {")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvWorldY = (modelMatrix * vec4(position, 1.0)).y;\nvWorldN = normalize(mat3(modelMatrix) * normal);",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          "uniform float uRiser;\nuniform vec3 uCream;\nuniform vec3 uCreamDark;\nuniform vec3 uWall;\nvarying float vWorldY;\nvarying vec3 vWorldN;\nvoid main() {",
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        if (uRiser > 0.0) {
          if (vWorldN.y > 0.7) {
            float band = mod(floor(vWorldY / uRiser + 0.001), 2.0);
            diffuseColor.rgb = mix(uCreamDark, uCream, band);
          } else {
            diffuseColor.rgb = uWall;
          }
        }`,
        );
    };
    m.customProgramCacheKey = () => "elmstead-stair-bands";
    m.needsUpdate = true;
  }
  interface StairMesh {
    mesh: THREE.Mesh;
    edges: THREE.LineSegments;
  }
  let stairMeshes: StairMesh[] = [];

  function addStairEdges(model: FragmentsModel) {
    model.object.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const m = obj.material;
      if (!(m instanceof THREE.MeshLambertMaterial) || styleOf(m) !== "stair") return;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(obj.geometry, 30), stairEdgeMaterial);
      obj.add(edges);
      stairMeshes.push({ mesh: obj, edges });
    });
  }

  function applyStairPresentation() {
    for (const m of fragments.core.models.materials.list.values()) {
      if (m instanceof THREE.MeshLambertMaterial && styleOf(m) === "stair") patchStairBands(m);
    }
    for (const s of stairMeshes) s.edges.visible = true;
  }

  /**
   * Map-style input: left drag or one finger pans; the wheel or a pinch zooms; the middle or right
   * button, or three fingers, orbits. OBC's projection switch rebinds the wheel and middle button, so
   * this runs again after each switch. The pinch must be a true zoom in the orthographic views,
   * where moving the camera closer changes nothing on screen.
   */
  function setNavigationInput() {
    const { ACTION } = CameraControls;
    const controls = world.camera.controls;
    const ortho = world.camera.projection.current === "Orthographic";
    controls.mouseButtons.left = ACTION.TRUCK;
    controls.mouseButtons.middle = ACTION.ROTATE;
    controls.mouseButtons.right = ACTION.ROTATE;
    controls.touches.one = ACTION.TOUCH_TRUCK;
    controls.touches.two = ortho ? ACTION.TOUCH_ZOOM : ACTION.TOUCH_DOLLY;
    controls.touches.three = ACTION.TOUCH_ROTATE;
    // camera-controls scales each pinch step from the camera's current, still-easing zoom, so any
    // lag behind the fingers loses most of the pinch. Track drags without easing.
    controls.draggingSmoothTime = 0;
  }

  /**
   * Three.js is Y-up with plan north along −Z (IFC +Y).
   */
  async function setView(view: View) {
    const frame = shownBox().clone();
    // The plan box is only 1 m tall; interactive views frame the shown storeys' real height so the
    // whole building fits. Snapshots keep the plan box and the framing their PNGs were rendered with.
    if (!snapshot && modelJson) {
      const shown = modelJson.storeys.filter((s) => isShown(s.id));
      if (shown.length) {
        const tops = shown.flatMap((s) => [
          s.elevation,
          ...s.walls.map((w) => s.elevation + wallHeight(w)),
          ...s.slabs.map((sl) => s.elevation + sl.elevationOffset),
        ]);
        const bottoms = shown.flatMap((s) => [
          s.elevation,
          ...s.slabs.map((sl) => s.elevation + sl.elevationOffset - sl.thickness),
        ]);
        frame.min.y = Math.min(...bottoms) / 1000;
        frame.max.y = Math.max(...tops) / 1000;
      }
    }
    const centre = frame.getCenter(new THREE.Vector3());
    const angle = orient === "project" ? 0 : (northAngle ?? 0);
    const { direction, projection } = cameraForView(view, snapshot, angle);
    await world.camera.projection.set(projection);
    // Start well outside the model, then fit to its bounding sphere: fitToSphere keeps the viewing
    // direction (fitToBox would snap to the nearest face).
    const sphere = frame.getBoundingSphere(new THREE.Sphere());
    const d = new THREE.Vector3(...direction).normalize().multiplyScalar(sphere.radius * 4);
    await world.camera.controls.setLookAt(
      centre.x + d.x,
      centre.y + d.y,
      centre.z + d.z,
      centre.x,
      centre.y,
      centre.z,
      false,
    );
    // Top looks straight down the height, so its sphere is loose and takes a tighter factor; the
    // corner views fit the whole sphere plus a little air, so no corner of the building is cropped.
    // Interactive views sit a touch looser than the snapshots the PNGs were rendered with.
    // A turned Top view widens the plan box on screen, so the snapshot's tight factor widens with it.
    const { clientWidth, clientHeight } = world.renderer!.three.domElement;
    const size = frame.getSize(new THREE.Vector3());
    const turned = turnedTopFit(size.x / 2, size.z / 2, angle, clientWidth / clientHeight);
    sphere.radius *= view === "top" ? (snapshot ? 0.78 * turned : 1) : snapshot ? 0.92 : 1.1;
    await world.camera.controls.fitToSphere(sphere, false);
    await fragments.core.update(true);
    updateCompass();
    updateLabelOrientation();
  }

  /**
   * ?camera=px,py,pz,tx,ty,tz: a perspective camera at p looking at t, in the scene's metres (Y up,
   * IFC +Y along −Z), for close-ups such as one window. Overrides the view on load.
   */
  async function setCamera(spec: string) {
    const v = spec.split(",").map(Number);
    if (v.length !== 6 || v.some((n) => !Number.isFinite(n)))
      throw new Error(`?camera needs six numbers, got "${spec}"`);
    await world.camera.projection.set("Perspective");
    await world.camera.controls.setLookAt(v[0]!, v[1]!, v[2]!, v[3]!, v[4]!, v[5]!, false);
    await fragments.core.update(true);
    updateCompass();
    updateLabelOrientation();
  }

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
    if (snapshot || savedView) return;
    hideHover();
    setMeasuring(false);
    clearMeasurements();
    const controls = world.camera.controls;
    const ortho = world.camera.threeOrtho;
    savedView = {
      projection: world.camera.projection.current,
      position: controls.getPosition(new THREE.Vector3()),
      target: controls.getTarget(new THREE.Vector3()),
      ortho: { left: ortho.left, right: ortho.right, top: ortho.top, bottom: ortho.bottom, zoom: ortho.zoom },
      near: world.camera.threePersp.near,
      fov: world.camera.threePersp.fov,
    };
    const start = entryPosition(shownBox(), lowestElevation);
    walkEyeY = start.y;
    await world.camera.projection.set("Perspective");
    world.camera.enabled = false;
    controls.enabled = false;
    const camera = world.camera.threePersp; // the active camera after the projection switch
    camera.near = WALK_NEAR;
    camera.fov = WALK_FOV;
    camera.updateProjectionMatrix();
    camera.position.copy(start);
    camera.quaternion.identity(); // an identity quaternion faces scene −Z, which is plan north
    if (!pointerLockControls) {
      // Created lazily, after the first projection switch, so it holds the perspective camera.
      pointerLockControls = new PointerLockControls(camera, world.renderer!.three.domElement);
      pointerLockControls.addEventListener("lock", () => {
        everLocked = true;
        store.set({ walkHint: false });
      });
      pointerLockControls.addEventListener("unlock", () => {
        // Escape is the browser's pointer-lock release, so unlocking performs the exit — but only
        // an unlock after a successful lock, so a refused request keeps walk mode.
        if (everLocked) void exitWalk();
      });
    }
    everLocked = false;
    store.set({ walking: true, walkHint: true });
    walkLast = performance.now();
    walkRaf = requestAnimationFrame(walkFrame);
    if (lock) pointerLockControls.lock();
    await fragments.core.update(true);
    updateCompass();
    updateLabelOrientation();
  }

  /** Leave walk mode, restoring the saved projection, pose and orthographic framing exactly. */
  async function exitWalk() {
    const restore = savedView;
    if (!restore) return;
    savedView = null;
    cancelAnimationFrame(walkRaf);
    walkKeys.clear();
    if (pointerLockControls?.isLocked) pointerLockControls.unlock();
    store.set({ walking: false, walkHint: false, status: `${currentName}.ifc` });
    world.camera.enabled = true;
    world.camera.threePersp.near = restore.near;
    world.camera.threePersp.fov = restore.fov;
    world.camera.threePersp.updateProjectionMatrix();
    await world.camera.projection.set(restore.projection);
    if (restore.projection === "Orthographic") {
      // The projection switch recomputes the ortho frustum from the walk pose and resets the zoom;
      // put the saved framing back so a Top view returns exactly as it was. The zoom goes through
      // zoomTo because camera-controls keeps its own zoom state and writes it back to the camera
      // on the next update.
      Object.assign(world.camera.threeOrtho, restore.ortho);
      world.camera.threeOrtho.updateProjectionMatrix();
      await world.camera.controls.zoomTo(restore.ortho.zoom, false);
    }
    const { position: p, target: t } = restore;
    await world.camera.controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
    world.camera.controls.enabled = true;
    await fragments.core.update(true);
    updateCompass();
    updateLabelOrientation();
    repickHover();
  }

  /** The walk frame loop: heading-relative movement at the fixed eye height, through all geometry. */
  function walkFrame(now: number) {
    if (!savedView) return;
    const camera = world.camera.three;
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
      void fragments.core.update();
      updateCompass();
    }
    // The heading changes as the walker looks around, not only when the position moves.
    updateLabelOrientation();
    walkLast = now;
    walkRaf = requestAnimationFrame(walkFrame);
  }

  // `?walk=1` (and a refused lock) leave walk mode without pointer lock: the first canvas click
  // requests it, which is the user gesture the browser requires.
  world.renderer!.three.domElement.addEventListener("click", () => {
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
    store.set({ walkHint: true, status: "pointer lock refused — click to retry; WASD still moves, Esc leaves" });
  });

  function measureLine(from: THREE.Vector3, to: THREE.Vector3): Line2 {
    const geometry = new LineGeometry();
    geometry.setPositions([from.x, from.y, from.z, to.x, to.y, to.z]);
    const line = new Line2(geometry, measureLineMaterial);
    line.frustumCulled = false;
    line.renderOrder = 8;
    return line;
  }

  function measureMarker(at: THREE.Vector3): THREE.Mesh {
    const marker = new THREE.Mesh(measureMarkerGeometry, measureMarkerMaterial);
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
    measureLayer.add(measureLine(m.from, m.to));
    measureLayer.add(measureMarker(m.from));
    measureLayer.add(measureMarker(m.to));
    const label = measureBillboard(m.id, m.values);
    label.position.copy(m.from.clone().add(m.to).multiplyScalar(0.5));
    measureLayer.add(label);
  }

  function removePendingMarker() {
    if (pendingMarker) {
      measureLayer.remove(pendingMarker);
      pendingMarker = null;
    }
  }

  function showPendingMarker(at: THREE.Vector3) {
    removePendingMarker();
    pendingMarker = measureMarker(at);
    measureLayer.add(pendingMarker);
  }

  function clearMeasureLayer() {
    // Every measurement line shares one material, and every marker one geometry and material.
    const shared = new Set<THREE.BufferGeometry | THREE.Material>([
      measureLineMaterial,
      measureMarkerGeometry,
      measureMarkerMaterial,
    ]);
    for (const obj of measureLayer.children) disposeTree(obj, shared);
    measureLayer.clear();
    pendingMarker = null;
  }

  function updateMeasureHook() {
    window.__elmsteadMeasurements = measurements.map((m) => ({
      id: m.id,
      from: { x: m.from.x, y: m.from.y, z: m.from.z },
      to: { x: m.to.x, y: m.to.y, z: m.to.z },
      values: { ...m.values },
    }));
  }

  function updateMeasureList() {
    store.set({ measurements: measurements.map((m) => ({ id: m.id, summary: measurementSummary(m.id, m.values) })) });
  }

  function updateClearButton() {
    store.set({ canClear: measurements.length > 0 || pendingPoint !== null });
  }

  function updateMeasureUi() {
    updateMeasureList();
    updateMeasureHook();
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
      updateMeasureUi();
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

  function clearMeasurements() {
    measureEpoch++;
    queuedPick = null;
    pendingPoint = null;
    measurements.length = 0;
    nextMeasurementId = 1;
    clearMeasureLayer();
    updateMeasureUi();
  }

  function setMeasuring(on: boolean) {
    if (measuring === on) return;
    if (!on) cancelPending();
    measuring = on;
    store.set({ measuring: on, measureHint: on });
  }

  /** The snapped or face point under a client-space position, in scene metres. */
  async function pickAt(x: number, y: number): Promise<THREE.Vector3 | null> {
    const model = currentModel;
    if (!model) return null;
    const camera = world.camera.three;
    const mouse = new THREE.Vector2(x, y);
    const results = await model.raycastWithSnapping({
      camera,
      mouse,
      dom: canvas,
      snappingClasses: [SnappingClass.POINT, SnappingClass.LINE],
    });
    const rect = canvas.getBoundingClientRect();
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
    const face = await model.raycast({ camera, mouse: new THREE.Vector2(x, y), dom: canvas });
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
        const model = currentModel;
        if (!measuring || !model) continue;
        const point = await pickAt(next.x, next.y);
        if (point && epoch === measureEpoch && currentModel === model && measuring) addPickPoint(point);
      }
    } catch (e) {
      console.error("measure pick failed", e);
    } finally {
      picking = false;
      if (queuedPick && measuring) void runPicks();
    }
  }

  function queuePick(x: number, y: number) {
    if (!measuring || snapshot) return;
    queuedPick = { x, y };
    void runPicks();
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!measuring || snapshot) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    measurePointers.add(e.pointerId);
    if (measurePointers.size > 1) {
      pointerCandidate = null;
      return;
    }
    pointerCandidate = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener("pointerup", (e) => {
    const candidate = pointerCandidate;
    measurePointers.delete(e.pointerId);
    if (!measuring || snapshot) return;
    if (!candidate || candidate.id !== e.pointerId) return;
    pointerCandidate = null;
    if (!isMeasureGesture(candidate, { x: e.clientX, y: e.clientY })) return;
    queuePick(e.clientX, e.clientY);
  });

  const endMeasurePointer = (e: PointerEvent) => {
    measurePointers.delete(e.pointerId);
    if (pointerCandidate?.id === e.pointerId) pointerCandidate = null;
  };
  canvas.addEventListener("pointercancel", endMeasurePointer);
  window.addEventListener("blur", () => {
    measurePointers.clear();
    pointerCandidate = null;
  });

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape" || !measuring || snapshot) return;
    if (pendingPoint) cancelPending();
    else setMeasuring(false);
  });
  updateMeasureUi();

  let hoverSprite: THREE.Sprite | null = null;
  let identifying = false;
  const idsRequested = !snapshot && params.get("ids") === "1";
  /** Model id and name per fragments item, rebuilt on every load; Tags exist even without model JSON. */
  const elementLabels = new Map<number, ElementLabel>();
  let hoverQueued: { x: number; y: number } | null = null;
  let hoverPicking = false;
  let hoverEpoch = 0;
  let lastPointer: { x: number; y: number } | null = null;
  window.__elmsteadHover = null;

  /** A load, storey choice or walk exit can finish under a stationary cursor; re-pick its position. */
  function repickHover() {
    if (identifying && !snapshot && !savedView && lastPointer) {
      hoverQueued = { ...lastPointer };
      void runHoverPicks();
    }
  }

  function disposeHoverSprite() {
    if (!hoverSprite) return;
    world.scene.three.remove(hoverSprite);
    disposeTree(hoverSprite);
    hoverSprite = null;
  }

  function hideHover() {
    disposeHoverSprite();
    window.__elmsteadHover = null;
  }

  function setIdentifying(on: boolean) {
    identifying = on;
    store.set({ ids: on });
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
        const model = currentModel;
        if (!identifying || snapshot || savedView || !model) continue;
        const ray = { camera: world.camera.three, mouse: new THREE.Vector2(next.x, next.y), dom: canvas };
        const ghost = ghostModel;
        // In Diff mode the removed elements' ghosts are picked too, and the nearer hit wins.
        const [own, removed] = await Promise.all([
          model.raycast(ray),
          ghost ? ghost.raycast(ray) : Promise.resolve(null),
        ]);
        if (epoch !== hoverEpoch || currentModel !== model || !identifying || savedView) continue;
        const ghostHit = removed && ghostLabels.has(removed.localId) && (!own || removed.distance < own.distance);
        const hit = ghostHit ? removed : own;
        const label = hit ? (ghostHit ? ghostLabels : elementLabels).get(hit.localId) : undefined;
        if (!hit || !label) {
          hideHover();
          continue;
        }
        const diffStatus = ghostHit ? "removed" : shownDiff?.status.get(label.id);
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
          world.scene.three.add(hoverSprite);
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

  canvas.addEventListener("pointermove", (e) => {
    lastPointer = { x: e.clientX, y: e.clientY };
    // Walk mode keeps pointermove firing when pointer lock is refused, so gate on it here too.
    if (!identifying || snapshot || savedView || e.buttons !== 0) {
      hideHover();
      return;
    }
    hoverQueued = { x: e.clientX, y: e.clientY };
    void runHoverPicks();
  });
  canvas.addEventListener("pointerleave", hideHover);

  /** A loaded model and the stair outlines added to its meshes. */
  interface Resident {
    model: FragmentsModel;
    stairs: StairMesh[];
  }

  /**
   * The shown model's loaded revisions, Existing included, by name. Loading a model into Fragments is
   * most of a switch, so each one stays loaded once shown and a switch only swaps which one is in
   * the scene. Choosing another model disposes them; a rebuilt IFC is released and fetched again
   * (see reloadModel), so nothing goes stale.
   */
  const resident = new Map<string, Resident>();
  /** The model group the latest load is for, so a load overtaken by a model change can clean up. */
  let loadingGroup = "";

  /**
   * A model of this group, loaded once and kept (see `resident`), not added to the scene; null when its
   * IFC is not in out/. `fresh` says it was loaded now, so its stair outlines are still to add.
   */
  async function loadResident(name: string, group: string): Promise<{ entry: Resident; fresh: boolean } | null> {
    const kept = resident.get(name);
    if (kept) return { entry: kept, fresh: false };
    const res = await fetch(`/out/${name}.ifc`);
    if (!res.ok) return null;
    const model = await ifcLoader.load(new Uint8Array(await res.arrayBuffer()), true, name);
    model.useCamera(world.camera.three);
    // Always full geometry. By default Fragments draws items it judges small on screen as lines (its
    // LOD), and glazing bars and window frames qualify even close up: they showed as thin lines you
    // could see through. Our models are small enough not to need it.
    await model.setLodMode(LodMode.ALL_VISIBLE);
    const entry = { model, stairs: [] };
    resident.set(name, entry);
    // Overtaken by a change to another model: this one will not be shown, so let it go.
    if (loadingGroup !== group) await disposeResident(name);
    return { entry, fresh: true };
  }

  async function disposeResident(name: string) {
    const r = resident.get(name);
    if (!r) return;
    resident.delete(name);
    // A reload disposes before `load` does its own scene sweep, so take this object out here too.
    world.scene.three.remove(r.model.object);
    for (const s of r.stairs) s.edges.geometry.dispose();
    if (currentModel === r.model) currentModel = null;
    try {
      await fragments.core.disposeModel(r.model.modelId);
    } catch {
      // a newer load may already have disposed it
    }
  }

  /**
   * Load `out/<name>.ifc` and its JSON. A revision switch keeps the view: the camera, projection and
   * framing stay as they are (`?view=` and `?camera=` only apply when a model is first opened), while
   * the extent the grid and the view buttons use follows the new model.
   */
  async function load(name: string, { keepView = false }: { keepView?: boolean } = {}) {
    const epoch = ++loadEpoch;
    await finishStoreyMotion();
    settledStoreys = null;
    currentModel = null;
    hoverEpoch++;
    hideHover();
    elementLabels.clear();
    // The old model's plan layers and labels are drawings of it; clear them even if this load fails.
    clearLabelLayers();
    window.__elmsteadRoomLabels = [];
    clearMeasurements();
    setStatus(`loading ${name}.ifc…`);
    // Take the shown model out of the scene; keep this model's revisions loaded, dispose the rest.
    const group = splitName(name).model;
    loadingGroup = group;
    for (const r of resident.values()) world.scene.three.remove(r.model.object);
    stairMeshes = [];
    for (const n of [...resident.keys()]) if (splitName(n).model !== group) await disposeResident(n);
    if (epoch !== loadEpoch) return;
    const res = await fetch(`/out/${name}.building.json`);
    const json = res.ok ? ((await res.json()) as BuildingModel) : null;
    if (epoch !== loadEpoch) return;
    parseStoreysParam(json);
    populateStoreySelector(json);
    // One shared riser for the banding: Fragments renders all stairs under one material, so the
    // shader cannot hold a riser per stair. Take the largest so the stair with the most steps reads
    // correctly; other stairs band on it too.
    stairRiser = 0;
    for (const s of json?.storeys ?? []) {
      for (const st of s.stairs ?? []) {
        const to = json!.storeys.find((x) => x.id === st.toStoreyId);
        const total = st.segments.reduce((n, g) => (g.kind === "flight" ? n + g.risers : n), 0);
        if (to && total > 0) stairRiser = Math.max(stairRiser, (to.elevation - s.elevation) / total / 1000);
      }
    }
    const loaded = await loadResident(name, group);
    if (!loaded) throw new Error(`out/${name}.ifc not found`);
    const { entry, fresh } = loaded;
    if (epoch !== loadEpoch) return; // a newer load owns the scene; this model stays loaded, out of it
    // The diff decides how the plan layers below are drawn, so it is worked out first.
    await refreshDiff(name, json);
    if (epoch !== loadEpoch) return;
    const { model } = entry;
    world.scene.three.add(model.object);
    currentModel = model;
    stairMeshes = entry.stairs;
    await fragments.core.update(true);
    if (epoch !== loadEpoch) return;
    for (const [localId, item] of await model.getItems()) {
      const label = elementLabel(item.data);
      if (label) elementLabels.set(localId, label);
    }
    if (epoch !== loadEpoch) return;
    await loadLabels(name, json, epoch);
    if (epoch !== loadEpoch) return;
    await applyStoreyVisibility(model);
    if (epoch !== loadEpoch) return;
    applyStyle();
    if (fresh) addStairEdges(model);
    applyStairPresentation();
    box = model.box.clone();
    grid.three.position.y = box.min.y - 0.01; // under the lowest slab, so it doesn't show through floors
    if (keepView) {
      updateCompass();
      updateLabelOrientation();
    } else {
      await setView(parseView(params.get("view"))); // the plan view, unless the URL asks for another
      if (epoch !== loadEpoch) return;
      if (params.get("camera")) await setCamera(params.get("camera")!);
    }
    if (epoch !== loadEpoch) return;
    await dressModel(model, name);
    if (epoch !== loadEpoch) return;
    setStatus(`${name}.ifc${storeysNote}${diffNote}`);
    window.__elmsteadNote = diffNote;
    repickHover();
  }

  /**
   * The diff of revision `name` against its base, while Diff mode is on: fetched and computed, with
   * each listed id's status for the categories the panel shows. Null on a base model or with Diff off.
   */
  async function refreshDiff(name: string, json: BuildingModel | null) {
    const { model: baseName, revision: rev } = splitName(name);
    diffNote = "";
    if (!viewState.diff || rev === null || !json) {
      shownDiff = null;
    } else {
      if (!baseJson.has(baseName)) {
        const res = await fetch(`/out/${baseName}.building.json`);
        baseJson.set(baseName, res.ok ? ((await res.json()) as BuildingModel) : null);
      }
      const base = baseJson.get(baseName) ?? null;
      if (!base) {
        shownDiff = null;
        diffNote = ` · Diff needs ${baseName} built`;
      } else {
        const diff = diffModels(base, json);
        shownDiff = { baseName, base, diff, status: statusById(diff, shownCategories) };
      }
    }
    window.__elmsteadDiff = shownDiff
      ? {
          added: shownDiff.diff.added.map((e) => e.id),
          changed: shownDiff.diff.changed.map((e) => e.id),
          removed: shownDiff.diff.removed.map((e) => e.id),
        }
      : null;
    publishChanges();
  }

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
    if (ghostModel && ghostModel !== model) world.scene.three.remove(ghostModel.object);
    ghostModel = null;
    ghostItems = new Map();
    ghostLabels.clear();
  }

  const outlineMaterials: Record<DiffStatus, THREE.LineBasicMaterial> = {
    added: new THREE.LineBasicMaterial({ color: DIFF_COLOURS.added.accent }),
    changed: new THREE.LineBasicMaterial({ color: DIFF_COLOURS.changed.accent }),
    removed: new THREE.LineBasicMaterial({ color: DIFF_COLOURS.removed.accent }),
  };

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
        group.visible = isShown(storey);
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

  /** Each element id's storey in a model, from its JSON. */
  const storeyIndex = (m: BuildingModel): Map<string, string> =>
    new Map(idNodes(m).flatMap((n) => ("storey" in n ? [[n.element.id, n.storey] as const] : [])));

  /**
   * The shown model drawn as Diff and Transparency now require: reset first, so a kept revision never
   * keeps an earlier session's colours; then the diff's highlights, outlines and ghosts; then
   * Transparency, on the IFC and on the plan drawing.
   */
  async function dressModel(model: FragmentsModel, name: string) {
    await undress(model);
    const isRevision = splitName(name).revision !== null;
    store.set({ diffAvailable: isRevision, diff: viewState.diff && isRevision, xray: viewState.xray });
    const coloured = new Set<number>();
    if (shownDiff && modelJson) {
      const here = storeyIndex(modelJson);
      const { byStatus } = await itemsByStatus(model, shownDiff.status, (id) => here.get(id));
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
    if (viewState.xray) {
      const all = [...(await model.getItems()).keys()];
      const faded = all.filter((id) => !coloured.has(id));
      if (faded.length) await model.setOpacity(faded, FADE);
    }
    fadePlan(viewState.xray);
    await fragments.core.update(true);
  }

  /** The removed elements, drawn from the base model in the removed fill, see-through and outlined. */
  async function dressGhosts(model: FragmentsModel) {
    if (!shownDiff) return;
    const removed = new Map([...shownDiff.status].filter(([, s]) => s === "removed"));
    if (!removed.size) return;
    const loaded = await loadResident(shownDiff.baseName, splitName(shownDiff.baseName).model);
    if (!loaded) {
      diffNote = ` · removed elements need ${shownDiff.baseName} built`;
      return;
    }
    const ghost = loaded.entry.model;
    if (ghost === model) return;
    await ghost.resetHighlight();
    await ghost.resetOpacity(undefined);
    const there = storeyIndex(shownDiff.base);
    const { byStatus, plain } = await itemsByStatus(ghost, removed, (id) => there.get(id));
    if (plain.length) await ghost.setVisible(plain, false);
    ghostItems = byStatus.removed;
    const ids = [...ghostItems.values()].flat();
    for (const [storey, storeyIds] of ghostItems) await ghost.setVisible(storeyIds, isShown(storey));
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
    world.scene.three.add(ghost.object);
    ghostModel = ghost;
    await outline(ghost, ghostItems, "removed");
  }

  const setFlag = (key: string, on: boolean) => {
    if (on) params.set(key, "1");
    else params.delete(key);
    history.replaceState(null, "", `?${params}`);
  };

  /** View changes run one after another, so two quick clicks can't interleave their dressing. */
  let viewChain: Promise<void> = Promise.resolve();

  /** How long a Diff or Transparency toggle crossfades from the previous picture to the new one. */
  const VIEW_FADE_MS = 60;

  interface ViewFade {
    play(): Promise<void>;
    remove(): void;
  }

  /** Keep the last drawn frame over the canvas, so a view change can dissolve into the new picture. */
  function beginViewFade(): ViewFade | null {
    if (!canvas.width || !canvas.height) return null;
    const fade = document.createElement("canvas");
    fade.width = canvas.width;
    fade.height = canvas.height;
    fade.dataset.viewFade = "";
    fade.setAttribute("aria-hidden", "true");
    Object.assign(fade.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });
    const context = fade.getContext("2d");
    if (!context) return null;
    context.drawImage(canvas, 0, 0);
    container.appendChild(fade);
    window.__elmsteadViewFades = (window.__elmsteadViewFades ?? 0) + 1;
    return {
      async play() {
        const animation = fade.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: VIEW_FADE_MS,
          easing: "ease-out",
          fill: "forwards",
        });
        await animation.finished.catch(() => {});
        fade.remove();
      },
      remove() {
        fade.remove();
      },
    };
  }

  /**
   * Apply a change to the view (a toggle, a panel checkbox) to the shown model, with the old picture
   * held until the new one is complete. A Diff or Transparency toggle then crossfades the old
   * picture away. Tell tests the change has been drawn once the fade is done too.
   */
  function applyViewChange(change: () => void, animate = false): Promise<void> {
    viewChain = viewChain.then(async () => {
      await finishStoreyMotion();
      const fade = animate && !snapshot && !prefersReducedMotion() ? beginViewFade() : null;
      const model = currentModel;
      try {
        holdingFrame++;
        world.renderer!.enabled = false;
        try {
          change();
          if (model && modelJson) {
            const epoch = loadEpoch;
            await refreshDiff(model.modelId, modelJson);
            await loadLabels(model.modelId, modelJson, epoch);
            if (epoch !== loadEpoch) return;
            applyStyle();
            await dressModel(model, model.modelId);
            setStatus(`${model.modelId}.ifc${storeysNote}${diffNote}`);
            window.__elmsteadNote = diffNote;
          }
        } finally {
          world.renderer!.enabled = --holdingFrame === 0;
        }
        // The new picture is ready to draw under the old one; fade it in straight away.
        if (fade) await fade.play();
        else await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      } finally {
        fade?.remove();
      }
      window.__elmsteadViewChanges = (window.__elmsteadViewChanges ?? 0) + 1;
    });
    return viewChain;
  }

  const toggleDiff = () => applyViewChange(() => setFlag("diff", (viewState.diff = !viewState.diff)), true);

  const SIGN: Record<DiffStatus, string> = { added: "+", changed: "~", removed: "−" };

  /**
   * The changes panel's state, while Diff mode is on: each category's count with a checkbox to show
   * or hide it, then every change of the shown storeys, by storey, each framing its element when
   * clicked.
   */
  function publishChanges() {
    if (!shownDiff || snapshot) {
      store.set({ changes: null });
      return;
    }
    const { diff, base } = shownDiff;
    const categories: ChangeCategory[] = (["added", "changed", "removed"] as const).map((status) => ({
      status,
      count: diff[status].length,
      checked: shownCategories[status],
      fill: DIFF_COLOURS[status].fill,
      accent: DIFF_COLOURS[status].accent,
    }));
    const storeys = modelJson?.storeys ?? base.storeys;
    const groups: ChangeGroup[] = [];
    for (const storey of storeys) {
      if (!isShown(storey.id)) continue;
      const entries = (["added", "changed", "removed"] as const).flatMap((status) =>
        shownCategories[status]
          ? diff[status]
              .filter((e) => e.storey === storey.id)
              .map((e) => ({ id: e.id, status, label: `${SIGN[status]} ${e.id}`, color: DIFF_COLOURS[status].accent }))
          : [],
      );
      if (entries.length) groups.push({ storeyId: storey.id, storeyName: storey.name, entries });
    }
    store.set({ changes: { categories, groups } });
  }

  /** Frame the camera on a change, in the direction it is looking, showing its storey first if hidden. */
  async function flyToChange(id: string, status: DiffStatus, storey: string) {
    if (!isShown(storey)) await applyStoreyChoice(storey);
    const model = status === "removed" ? ghostModel : currentModel;
    if (!model) return;
    const ids: number[] = [];
    for (const [localId, item] of await model.getItems())
      if ((item.data.Tag?.value ?? item.data.Name?.value) === id) ids.push(localId);
    if (!ids.length) return;
    const sphere = (await model.getMergedBox(ids)).getBoundingSphere(new THREE.Sphere());
    sphere.radius = Math.max(sphere.radius * 1.8, 1.5); // some context round it
    await world.camera.controls.fitToSphere(sphere, false);
    await fragments.core.update(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (window.__elmsteadViewChanges = (window.__elmsteadViewChanges ?? 0) + 1)),
    );
  }

  /** The diff's colours, as three.js hex strings, so Transparency can leave the diff's drawing solid. */
  const DIFF_HEX = new Set(
    Object.values(DIFF_COLOURS).flatMap((c) => [c.fill, c.accent, c.floor].map((h) => h.slice(1).toLowerCase())),
  );

  /**
   * Transparency on the plan drawing: every plan-style layer's materials faded, or back as they were.
   * The diff's own colours stay solid, as the changes do in 3D.
   */
  function fadePlan(on: boolean) {
    planLayers.traverse((o) => {
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

  function setLabels(on: boolean) {
    labels.visible = on;
    store.set({ labels: on });
    updateCompass();
  }

  function toggleLabels() {
    setLabels(!labels.visible);
  }

  function setConstraints(on: boolean) {
    constraints.visible = on;
    store.set({ constraints: on });
  }

  function toggleConstraints() {
    setConstraints(!constraints.visible);
  }

  /**
   * Name each corner button for the true direction its camera looks from (the cameras stay on the
   * plan corners), or for its plan corner without a north angle or with ?orient=project.
   */
  function publishViewLabels() {
    const angle = orient === "project" ? 0 : (northAngle ?? 0);
    const views: View[] = ["sw", "se", "ne", "nw", "top"];
    store.set({
      viewLabels: views.map((view) =>
        view === "top"
          ? { view, label: "Top", title: "Top view" }
          : {
              view,
              label: cornerLabel(view, angle),
              title: `Plan ${view.toUpperCase()} corner, seen from true ${cornerLabel(view, northAngle ?? 0)}`,
            },
      ),
    });
  }

  /** Choose a floor, then tell tests it has been applied and drawn. */
  async function applyStoreyChoice(topId: string): Promise<void> {
    await chooseStorey(topId);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (window.__elmsteadStoreyChanges = (window.__elmsteadStoreyChanges ?? 0) + 1)),
    );
  }

  /** The storey above (+1) or below (-1) the highest storey shown; undefined past either end. */
  function neighbourStorey(direction: 1 | -1): string | undefined {
    if (!modelJson) return undefined;
    const ordered = storeysLowestFirst(modelJson);
    const highest = ordered.reduce((found, s, i) => (isShown(s.id) ? i : found), -1);
    return highest < 0 ? undefined : ordered[highest + direction]?.id;
  }

  async function stepStorey(direction: 1 | -1): Promise<void> {
    if (snapshot || savedView || store.getSnapshot().storeyLabelHidden) return;
    const next = neighbourStorey(direction);
    if (!next) return;
    await applyStoreyChoice(next);
  }
  /** Every model in out/, with its revisions; filled at startup. */
  let groups = new Map<string, ModelGroup>();
  /** The revision shown, or null for the existing building (the base). */
  let revision: string | null = null;

  /** Reflect the shown model's revisions in the store, Existing first; hidden for a model with none. */
  function populateRevisionSelector(modelName: string, group: ModelGroup) {
    store.set({
      models: [...groups.keys()],
      model: modelName,
      revisions: [
        { value: "", text: "Existing", disabled: !group.base },
        ...group.revisions.map((r) => ({ value: r, text: r })),
      ],
      revision,
      revisionHidden: group.revisions.length === 0,
    });
  }

  /** Show `name`, a model or one of its revisions, setting both pickers and `?model=`. */
  async function show(name: string, opts: { keepView?: boolean } = {}) {
    const { model, revision: rev } = splitName(name);
    revision = rev;
    currentName = name;
    currentBaseModel = model;
    populateRevisionSelector(model, groups.get(model) ?? { base: true, revisions: [] });
    params.set("model", name);
    history.replaceState(null, "", `?${params}`);
    await load(name, opts);
  }

  async function chooseModel(model: string): Promise<void> {
    await exitWalk();
    const group = groups.get(model);
    if (group) await show(defaultName(model, group));
  }

  /** Revision switches in flight; the renderer draws only when there are none. */
  let holdingFrame = 0;

  /** Keep the old drawing buffer while `work` replaces the scene, then draw the finished result. */
  async function withHeldFrame(work: () => Promise<void>): Promise<void> {
    holdingFrame++;
    world.renderer!.enabled = false;
    try {
      await work();
    } finally {
      world.renderer!.enabled = --holdingFrame === 0;
    }
  }

  /** True while a revision step is loading, so a key press in that time is dropped rather than queued. */
  let switching = false;

  /**
   * Choose a revision of the shown model, keeping the view, then tell tests it has been drawn. The
   * renderer is paused while the revision loads, so the canvas keeps showing the previous revision
   * (the drawing buffer is preserved) until the new one is complete: no blank frames while it
   * converts, and no half-styled ones while its plan style, storeys and overlays are applied.
   */
  async function applyRevisionChoice(rev: string | null): Promise<void> {
    await exitWalk(); // as a model change does; the view it restores is the one kept
    await finishStoreyMotion();
    await withHeldFrame(() => show(joinName(currentBaseModel, rev), { keepView: true }));
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (window.__elmsteadRevisionChanges = (window.__elmsteadRevisionChanges ?? 0) + 1)),
    );
  }

  async function stepRevision(direction: 1 | -1): Promise<void> {
    if (snapshot || savedView || store.getSnapshot().revisionHidden || switching) return;
    const group = groups.get(currentBaseModel);
    if (!group) return;
    const next = nextRevision(group, revision, direction);
    if (next === undefined) return;
    switching = true;
    try {
      await applyRevisionChoice(next);
    } finally {
      switching = false;
    }
  }

  /** Tell tests a rebuilt model has been drawn. */
  function announceReload(): void {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (window.__elmsteadReloads = (window.__elmsteadReloads ?? 0) + 1)),
    );
  }

  /** Remove the ghost base and the shown model's dressing before a Diff base reload. */
  async function clearGhost(): Promise<void> {
    const model = currentModel;
    if (model) {
      await undress(model);
      return;
    }
    if (ghostModel) ghostModel.object.removeFromParent();
    ghostModel = null;
    ghostItems = new Map();
    ghostLabels.clear();
  }

  /**
   * A rebuilt IFC: refresh the pickers, release the stale copy and, when it is the shown model or the
   * base behind its Diff, swap the new model into the same view.
   */
  async function reloadModel(name: string): Promise<void> {
    const turn = viewChain.then(async () => {
      await finishStoreyMotion();
      try {
        const names: string[] = await (await fetch("/models.json")).json();
        groups = groupModels(names);
        populateRevisionSelector(currentBaseModel, groups.get(currentBaseModel) ?? { base: true, revisions: [] });
      } catch {
        // Keep the current pickers; the scene reload below still matters.
      }
      baseJson.delete(name);
      const shown = currentName;
      if (name !== shown) {
        if (viewState.diff && revision !== null && name === currentBaseModel) {
          await withHeldFrame(async () => {
            await clearGhost();
            await disposeResident(name);
            if (currentName === shown) await show(shown, { keepView: true });
          });
          if (currentName === shown) announceReload();
        } else {
          await disposeResident(name);
        }
        return;
      }
      await exitWalk();
      if (currentName !== name) {
        await disposeResident(name);
        return;
      }
      await withHeldFrame(async () => {
        await disposeResident(name);
        if (currentName === name) await show(name, { keepView: true });
      });
      if (currentName === name) announceReload();
    });
    viewChain = turn.catch((error: unknown) => {
      const message = `could not reload ${name}.ifc: ${error instanceof Error ? error.message : String(error)}`;
      console.error(message);
      setStatus(message);
    });
    return viewChain;
  }

  async function chooseView(view: View): Promise<void> {
    await exitWalk(); // choosing a view leaves walk mode before the view changes
    await setView(view);
  }

  async function toggleWalk(): Promise<void> {
    if (savedView) await exitWalk();
    else await enterWalk(true);
  }

  async function toggleMeasure(): Promise<void> {
    if (measuring) {
      setMeasuring(false);
      return;
    }
    await exitWalk();
    setMeasuring(true);
  }

  async function setXray(on: boolean): Promise<void> {
    await applyViewChange(() => setFlag("xray", (viewState.xray = on)), true);
  }

  async function toggleXray(): Promise<void> {
    await setXray(!viewState.xray);
  }

  async function setChangeCategory(status: DiffStatus, on: boolean): Promise<void> {
    await applyViewChange(() => {
      shownCategories[status] = on;
    });
  }

  function onCompass(listener: (state: { visible: boolean; turn: number } | null) => void): () => void {
    compassListeners.add(listener);
    return () => compassListeners.delete(listener);
  }

  async function start(): Promise<void> {
    try {
      const names: string[] = await (await fetch("/models.json")).json();
      if (!names.length) throw new Error("no IFC files in out/ — run npm run build <model> first");
      groups = groupModels(names);
      // No ?model= opens the first model. A model asked for by its base name opens its first revision
      // when only revisions are built. Any other name is loaded as asked, so a missing one fails loudly
      // rather than showing (or snapshotting) some other model.
      const requested = params.get("model") ?? defaultName(...[...groups][0]!);
      const group = groups.get(requested);
      await show(group && !names.includes(requested) ? defaultName(requested, group) : requested);
      if (idsRequested) setIdentifying(true);
      // `?walk=1` and `?measure=1` apply once, at startup; a model change leaves both modes alone.
      // Walk wins when both are present.
      if (walkRequested(params, snapshot)) void enterWalk(false);
      else if (measureRequested) setMeasuring(true);
      // Two frames so the renderer has drawn the final camera position before a snapshot.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.__elmsteadReady = true;
          store.set({ ready: true });
        }),
      );
    } catch (e) {
      setStatus(String(e));
      window.__elmsteadError = String(e);
      store.set({ error: String(e) });
    }
  }

  publishViewLabels();
  return {
    start,
    show,
    reloadModel,
    chooseModel,
    applyRevisionChoice,
    applyStoreyChoice,
    stepStorey,
    stepRevision,
    chooseView,
    setLabels,
    toggleLabels,
    setConstraints,
    toggleConstraints,
    setIds: setIdentifying,
    toggleIds: () => setIdentifying(!identifying),
    setMeasuring,
    toggleMeasure,
    clearMeasurements,
    toggleWalk,
    enterWalk,
    exitWalk,
    toggleDiff,
    setXray,
    toggleXray,
    setChangeCategory,
    flyToChange,
    onCompass,
  };
}
