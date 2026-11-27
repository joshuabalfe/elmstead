/**
 * Local IFC viewer on That Open Engine: loads out/<model>.ifc, converts it to Fragments in the
 * browser and shows it, with each storey's room names, areas and dimensions lying at its ceiling,
 * the model's constraints as red labels and dotted spans, a distance measurement tool, and a
 * compass pointing to true north (all from out/<model>.building.json and
 * out/<model>.constraints.json). A storey slider in the bar shows every storey up to the chosen
 * floor, and `?storeys=` shows an exact subset. A revision picker beside the model picker switches
 * between a model and its revisions (`?model=<model>@<revision>`) without moving the camera. Every view uses the plan's colours, with the plan's
 * walls, doors and windows laid on the wall tops, so the Top view reads like the plan. Query params:
 * ?model=<name>&view=<sw|se|ne|nw|top (default)>&snapshot=1&labels=0|1&constraints=0|1&storeys=a,b
 * &measure=1&style=plan|ifc&camera=px,py,pz,tx,ty,tz&walk=1&ids=0|1 (snapshot hides the UI and sets
 * window.__elmsteadReady once the first frame is drawn; labels and the plan style are on by
 * default and constraints start off, except in snapshots, which show the IFC alone; walk=1 enters
 * first-person free-fly mode and measure=1 starts the measurement tool, both ignored in snapshots).
 * The Ids button or ?ids=1 shows each element's model id and name at the hovered point on hover, in the constraint
 * label's style and above everything, and
 * room labels carry the room id under name and area.
 */
import * as OBC from "@thatopen/components";
import { LodMode, type FragmentsModel } from "@thatopen/fragments";
import workerUrl from "@thatopen/fragments/worker?url";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { wallHeight } from "../../shared/geometry/wall.js";
import { CARDINAL_NAMES, ELEVATION_NAMES, type CameraView } from "../../shared/render/views.js";
import { idNodes } from "../../shared/schema/ids.js";
import type { BuildingModel } from "../../shared/schema/schema.js";
import type { SceneContext } from "./context.js";
import { createDresser, type Dresser } from "./dress.js";
import { createMeasureTool, type MeasureTool } from "./measure.js";
import { createStoreyMotion, type StoreyMotion } from "./storey-motion.js";
import { createStyle, type StairMesh, type Style } from "./style.js";
import { createWalkMode, type WalkMode } from "./walk.js";
import { createIdentify, type Identify } from "./identify.js";
import { createDiffMode, type DiffMode } from "./diff-mode.js";
import { createLabels } from "./labels.js";
import type { DiffStatus } from "../../shared/diff/index.js";
import {
  defaultName,
  groupModels,
  joinName,
  splitName,
  stepRevision as nextRevision,
  type ModelGroup,
} from "../lib/revisions.js";
import { isStoreyPrefix, storeysLowestFirst } from "../lib/storeys.js";
import { cameraForView, parseOrient, parseView, turnedTopFit } from "../lib/view.js";
import type { ViewerStore } from "../state/store.js";

export interface ViewerApi {
  start(): Promise<void>;
  show(name: string, opts?: { keepView?: boolean }): Promise<void>;
  reloadModel(name: string): Promise<void>;
  chooseModel(model: string): Promise<void>;
  applyRevisionChoice(rev: string | null): Promise<void>;
  applyStoreyChoice(topId: string): Promise<void>;
  stepStorey(direction: 1 | -1): Promise<void>;
  stepRevision(direction: 1 | -1): Promise<void>;
  chooseView(view: CameraView): Promise<void>;
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
  enterWalk(lock: boolean, keepPose?: boolean): Promise<void>;
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
  // OBC sizes the ortho frustum from the perspective pose at the moment of the switch, so the
  // frustum (and the zoom floats fitToSphere derives from it) would depend on the previous view.
  // Remember the load-time pose; setView restores it before switching, keeping output deterministic.
  const defaultPerspPosition = world.camera.threePersp.position.clone();
  const defaultPerspTarget = world.camera.controls.getTarget(new THREE.Vector3());
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
    if (style && material instanceof THREE.MeshLambertMaterial) style.patchMaterial(material);
  });

  const ifcLoader = components.get(OBC.IfcLoader);
  // Keep IFC coordinates as they are (no shift to the origin) so the room labels line up with the model.
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: { path: "/wasm/", absolute: true },
    webIfc: { COORDINATE_TO_ORIGIN: false },
  });

  /** The loaded Fragments model, so a storey choice can update it without a reload. */
  let currentModel: FragmentsModel | null = null;

  /** The two view toggles, from `?diff=1` and `?xray=1`: Diff (revisions only) and Transparency. */
  const viewState = { diff: params.get("diff") === "1", xray: params.get("xray") === "1" };
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.__elmsteadNote = "";
  let loadEpoch = 0;
  /** The scene modules, created below where their state used to live. */
  let measure: MeasureTool;
  let walk: WalkMode;
  let identify: Identify;
  let dresser: Dresser;
  let storeyMotion: StoreyMotion;
  let diffMode: DiffMode;
  let style: Style;

  /** True north, degrees counter-clockwise from plan +y (site.northAngle); null when there is no model JSON. */
  let northAngle: number | null = null;
  /** The front's outward direction, degrees counter-clockwise from plan +y; plan south by default. */
  let frontAngle = 180;
  /** The lowest storey's elevation in scene metres, from the model JSON; null when there is none. */
  let lowestElevation: number | null = null;
  /** The model JSON beside the IFC; null when there is none. */
  let modelJson: BuildingModel | null = null;
  /** The storey ids `?storeys=` asked for, in the model's order; null means every storey. */
  let shownStoreys: string[] | null = null;
  /** Whether a storey is shown: the `?storeys=` selection, or every storey when it is absent. */
  const isShown = (id: string): boolean => shownStoreys === null || shownStoreys.includes(id);

  /** What the extracted scene modules share (see scene/context.ts). */
  const ctx: SceneContext = {
    params,
    snapshot,
    store,
    scene: world.scene.three,
    camera: world.camera,
    renderer: world.renderer!,
    fragments,
    canvas,
    prefersReducedMotion,
    storeyLayers: () => labels.storeyLayers(),
    setPlanVisible: (on) => labels.setPlanVisible(on),
    constraintLineMaterial: () => labels.constraintLineMaterial(),
    currentModel: () => currentModel,
    currentName: () => currentName,
    modelJson: () => modelJson,
    viewState: () => viewState,
    isShown,
    shownBox,
    lowestElevation: () => lowestElevation,
    ghostModel: () => dresser.ghostModel(),
    ghostLabel: (localId) => dresser.ghostLabel(localId),
    diffStatusOf: (id) => diffMode.statusOf(id),
    shownDiff: () => diffMode.shown(),
    storeyIndex: (model) => storeyIndex(model),
    loadResident: async (name, group) => (await loadResident(name, group))?.entry.model ?? null,
    planLayers: () => labels.planLayers(),
    setDiffNote: (note) => diffMode.setNote(note),
    setDressingStoreyVisibility: () => dresser.setStoreyVisibility(),
    publishChanges: () => diffMode.publish(),
    hideHover: () => identify.hide(),
    repickHover: () => identify.repick(),
    isWalking: () => walk.isWalking(),
    setMeasuring: (on) => measure.setMeasuring(on),
    clearMeasurements: () => measure.clear(),
    updateCompass,
    updateLabelOrientation: () => labels.updateOrientation(),
    onWalkExit: () => {
      updateCompass();
      labels.updateOrientation();
      identify.repick();
    },
    exitWalk: () => walk.exit(),
  };

  const labels = createLabels(ctx);
  diffMode = createDiffMode(ctx);
  store.set({
    labels: labels.labelsVisible(),
    constraints: labels.constraintsVisible(),
    diff: viewState.diff,
    xray: viewState.xray,
  });

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
    if (!labels.labelsVisible() || northAngle === null) {
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
  world.camera.controls.addEventListener("update", labels.updateOrientation);
  // A moving camera leaves any hover label naming the wrong element. Hide while it moves, then
  // re-pick once the updates settle: a trailing update would otherwise hide a pick made at load end.
  let hoverRepickTimer = 0;
  world.camera.controls.addEventListener("update", () => {
    identify.hide();
    clearTimeout(hoverRepickTimer);
    hoverRepickTimer = window.setTimeout(identify.repick, 120);
  });
  window.addEventListener("resize", updateCompass);

  /** Walk mode stands on the lowest storey the selection still shows. */
  function updateLowestElevation() {
    if (!modelJson) return;
    const shown = modelJson.storeys.filter((s) => isShown(s.id));
    const lowest = (shown.length ? shown : modelJson.storeys).reduce((a, b) => (b.elevation < a.elevation ? b : a));
    lowestElevation = lowest.elevation / 1000; // the JSON is millimetres, the scene metres
  }

  /**
   * The plan's drawings for each storey: dimensions, room labels and constraints at its ceiling,
   * and its plan floor and wall tops, built by the labels module once the constraints are fetched.
   */
  async function loadLabels(name: string, model: BuildingModel | null, epoch: number) {
    if (epoch !== loadEpoch) return;
    labels.clear();
    northAngle = null;
    frontAngle = 180;
    lowestElevation = null;
    modelJson = model;
    window.__elmsteadRoomLabels = [];
    if (!model) return publishViewLabels(); // no JSON next to the IFC: show the IFC without labels
    northAngle = model.site.northAngle ?? 0;
    frontAngle = model.site.frontAngle ?? 180;
    publishViewLabels();
    const resolved = await labels.constraints(name);
    if (epoch !== loadEpoch) return;
    updateLowestElevation();
    labels.build(model, resolved);
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

  /** Fill the selector's store state, pointing at the floor the selection reaches. */
  function populateStoreySelector(model: BuildingModel | null) {
    const ordered = model ? storeysLowestFirst(model) : [];
    const options = ordered.map((s) => ({ value: s.id, text: s.name }));
    const shown = new Set(shownStoreys ?? ordered.map((s) => s.id));
    const storeyIndex = Math.max(
      ordered.reduce((found, s, i) => (shown.has(s.id) ? i : found), -1),
      0,
    );
    if (ordered.length < 2) {
      store.set({ storeys: options, storeyDisabled: true, storeyIndex, storeyCustom: false });
      return;
    }
    // The URL asked for a set no single floor describes; say so until a floor is chosen.
    const storeyCustom = shownStoreys !== null && !isStoreyPrefix(shownStoreys, ordered);
    store.set({ storeys: options, storeyDisabled: false, storeyIndex, storeyCustom });
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
    await storeyMotion.apply(currentModel, true);
    // A later choice may have taken over while this one animated; that choice owns the finishing work.
    const shown = new Set(shownStoreys ?? ordered.map((s) => s.id));
    const latestTop = [...ordered].reverse().find((s) => shown.has(s.id))?.id;
    if (topId !== latestTop) return;
    updateLowestElevation();
    setStatus(`${currentName}.ifc`);
    // The camera stays put: only the drawings change, so floors compare from one viewpoint.
    await fragments.core.update(true);
    updateCompass();
    identify.repick();
  }

  storeyMotion = createStoreyMotion(ctx);

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
  /** ?orient=project keeps the views on plan axes, for the plan-versus-3D comparison; otherwise they follow true north. */
  const orient = parseOrient(params.get("orient"));

  style = createStyle(ctx, grid.three);

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
  async function setView(view: CameraView) {
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
    const { direction, projection } = cameraForView(view, snapshot, angle, frontAngle);
    if (projection === "Orthographic" && world.camera.projection.current === "Perspective") {
      const p = defaultPerspPosition;
      const t = defaultPerspTarget;
      await world.camera.controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
      // setLookAt only queues the pose; OBC reads the camera itself, so apply it before the switch.
      world.camera.controls.update(0);
    }
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
    // other views fit the whole sphere plus a little air, so no corner of the building is cropped.
    // Interactive views sit a touch looser than the snapshots the PNGs were rendered with.
    // A turned Top view widens the plan box on screen, so the snapshot's tight factor widens with it.
    const { clientWidth, clientHeight } = world.renderer!.three.domElement;
    const size = frame.getSize(new THREE.Vector3());
    const turned = turnedTopFit(size.x / 2, size.z / 2, angle, clientWidth / clientHeight);
    sphere.radius *= view === "top" ? (snapshot ? 0.78 * turned : 1) : snapshot ? 0.92 : 1.1;
    await world.camera.controls.fitToSphere(sphere, false);
    await fragments.core.update(true);
    updateCompass();
    labels.updateOrientation();
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
    labels.updateOrientation();
  }

  walk = createWalkMode(ctx);

  measure = createMeasureTool(ctx);

  identify = createIdentify(ctx);

  let stairMeshes: StairMesh[] = [];

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
    await storeyMotion.finish();
    storeyMotion.reset();
    currentModel = null;
    identify.reset();
    // The old model's plan layers and labels are drawings of it; clear them even if this load fails.
    labels.clear();
    window.__elmsteadRoomLabels = [];
    measure.clear();
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
    style.setModel(json);
    const loaded = await loadResident(name, group);
    if (!loaded) throw new Error(`out/${name}.ifc not found`);
    const { entry, fresh } = loaded;
    if (epoch !== loadEpoch) return; // a newer load owns the scene; this model stays loaded, out of it
    // The diff decides how the plan layers below are drawn, so it is worked out first.
    await diffMode.refresh(name, json);
    if (epoch !== loadEpoch) return;
    const { model } = entry;
    world.scene.three.add(model.object);
    currentModel = model;
    stairMeshes = entry.stairs;
    await fragments.core.update(true);
    if (epoch !== loadEpoch) return;
    await identify.labelsFor(model);
    if (epoch !== loadEpoch) return;
    await loadLabels(name, json, epoch);
    if (epoch !== loadEpoch) return;
    await storeyMotion.apply(model);
    if (epoch !== loadEpoch) return;
    style.apply();
    if (fresh) style.addStairEdges(model, stairMeshes);
    style.applyStairPresentation(stairMeshes);
    box = model.box.clone();
    grid.three.position.y = box.min.y - 0.01; // under the lowest slab, so it doesn't show through floors
    if (keepView) {
      updateCompass();
      labels.updateOrientation();
    } else {
      await setView(parseView(params.get("view"))); // the plan view, unless the URL asks for another
      if (epoch !== loadEpoch) return;
      if (params.get("camera")) await setCamera(params.get("camera")!);
    }
    if (epoch !== loadEpoch) return;
    await dresser.dress(model, name);
    if (epoch !== loadEpoch) return;
    setStatus(`${name}.ifc${storeysNote}${diffMode.note()}`);
    window.__elmsteadNote = diffMode.note();
    identify.repick();
  }

  /** Each element id's storey in a model, from its JSON. */
  const storeyIndex = (m: BuildingModel): Map<string, string> =>
    new Map(idNodes(m).flatMap((n) => ("storey" in n ? [[n.element.id, n.storey] as const] : [])));

  dresser = createDresser(ctx);

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
      await storeyMotion.finish();
      const fade = animate && !snapshot && !prefersReducedMotion() ? beginViewFade() : null;
      const model = currentModel;
      try {
        holdingFrame++;
        world.renderer!.enabled = false;
        try {
          change();
          if (model && modelJson) {
            const epoch = loadEpoch;
            await diffMode.refresh(model.modelId, modelJson);
            await loadLabels(model.modelId, modelJson, epoch);
            if (epoch !== loadEpoch) return;
            style.apply();
            await dresser.dress(model, model.modelId);
            setStatus(`${model.modelId}.ifc${storeysNote}${diffMode.note()}`);
            window.__elmsteadNote = diffMode.note();
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

  /** Frame the camera on a change, in the direction it is looking, showing its storey first if hidden. */
  async function flyToChange(id: string, status: DiffStatus, storey: string) {
    if (!isShown(storey)) await applyStoreyChoice(storey);
    const model = status === "removed" ? dresser.ghostModel() : currentModel;
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

  function setLabels(on: boolean) {
    labels.setLabelsVisible(on);
    store.set({ labels: on });
    updateCompass();
  }

  function toggleLabels() {
    setLabels(!labels.labelsVisible());
  }

  function setConstraints(on: boolean) {
    labels.setConstraintsVisible(on);
    store.set({ constraints: on });
  }

  function toggleConstraints() {
    setConstraints(!labels.constraintsVisible());
  }

  /** Name the compass snaps, the flat elevations and Top. */
  function publishViewLabels() {
    const views = ["n", "w", "e", "s", "front", "back", "left", "right", "top"] as const;
    store.set({
      viewLabels: views.map((view) => {
        if (view === "top") return { view, label: "Top", title: "Top view" };
        if (view === "front" || view === "back" || view === "left" || view === "right")
          return {
            view,
            label: ELEVATION_NAMES[view],
            title: `Flat ${ELEVATION_NAMES[view].toLowerCase()} elevation`,
          };
        return { view, label: view.toUpperCase(), title: `Isometric view from true ${CARDINAL_NAMES[view]}` };
      }),
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
    if (snapshot || walk.isWalking() || store.getSnapshot().storeyDisabled) return;
    const next = neighbourStorey(direction);
    if (!next) return;
    await applyStoreyChoice(next);
  }
  /** Every model in out/, with its revisions; filled at startup. */
  let groups = new Map<string, ModelGroup>();
  /** The revision shown, or null for the existing building (the base). */
  let revision: string | null = null;

  /** Reflect the shown model's revisions in the store, Existing first; disabled for a model with none. */
  function populateRevisionSelector(modelName: string, group: ModelGroup) {
    store.set({
      models: [...groups.keys()],
      model: modelName,
      revisions: [
        { value: "", text: "Existing", disabled: !group.base },
        ...group.revisions.map((r) => ({ value: r, text: r })),
      ],
      revision,
      revisionDisabled: group.revisions.length === 0,
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
    await walk.exit();
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
    await walk.exit(); // as a model change does; the view it restores is the one kept
    await storeyMotion.finish();
    await withHeldFrame(() => show(joinName(currentBaseModel, rev), { keepView: true }));
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (window.__elmsteadRevisionChanges = (window.__elmsteadRevisionChanges ?? 0) + 1)),
    );
  }

  async function stepRevision(direction: 1 | -1): Promise<void> {
    if (snapshot || walk.isWalking() || store.getSnapshot().revisionDisabled || switching) return;
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

  /**
   * A rebuilt IFC: refresh the pickers, release the stale copy and, when it is the shown model or the
   * base behind its Diff, swap the new model into the same view.
   */
  async function reloadModel(name: string): Promise<void> {
    const turn = viewChain.then(async () => {
      await storeyMotion.finish();
      try {
        const names: string[] = await (await fetch("/models.json")).json();
        groups = groupModels(names);
        populateRevisionSelector(currentBaseModel, groups.get(currentBaseModel) ?? { base: true, revisions: [] });
      } catch {
        // Keep the current pickers; the scene reload below still matters.
      }
      diffMode.forget(name);
      const shown = currentName;
      if (name !== shown) {
        if (viewState.diff && revision !== null && name === currentBaseModel) {
          await withHeldFrame(async () => {
            await dresser.clearGhost(currentModel);
            await disposeResident(name);
            if (currentName === shown) await show(shown, { keepView: true });
          });
          if (currentName === shown) announceReload();
        } else {
          await disposeResident(name);
        }
        return;
      }
      await walk.exit();
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

  async function chooseView(view: CameraView): Promise<void> {
    await walk.exit(); // choosing a view leaves walk mode before the view changes
    await setView(view);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => (window.__elmsteadViews = (window.__elmsteadViews ?? 0) + 1)),
    );
  }

  async function setXray(on: boolean): Promise<void> {
    await applyViewChange(() => setFlag("xray", (viewState.xray = on)), true);
  }

  async function toggleXray(): Promise<void> {
    await setXray(!viewState.xray);
  }

  async function setChangeCategory(status: DiffStatus, on: boolean): Promise<void> {
    await applyViewChange(() => {
      diffMode.setCategory(status, on);
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
      if (identify.requested()) identify.setIdentifying(true);
      // `?walk=1` and `?measure=1` apply once, at startup; a model change leaves both modes alone.
      // Walk wins when both are present.
      if (walk.requested()) void walk.enter(false, false);
      else if (measure.requested()) measure.setMeasuring(true);
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

  if (snapshot) window.__elmsteadChooseView = chooseView;
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
    setIds: identify.setIdentifying,
    toggleIds: () => identify.setIdentifying(!identify.isIdentifying()),
    setMeasuring: measure.setMeasuring,
    toggleMeasure: () => measure.toggle(),
    clearMeasurements: measure.clear,
    toggleWalk: () => walk.toggle(),
    enterWalk: walk.enter,
    exitWalk: walk.exit,
    toggleDiff,
    setXray,
    toggleXray,
    setChangeCategory,
    flyToChange,
    onCompass,
  };
}
