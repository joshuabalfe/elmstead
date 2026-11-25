/**
 * Local IFC viewer on That Open Engine: loads out/<model>.ifc, converts it to Fragments in the
 * browser and shows it, with each storey's room names, areas and dimensions lying at its ceiling,
 * the model's constraints as red labels and dotted spans, a distance measurement tool, and a
 * compass pointing to true north (all from out/<model>.building.json and
 * out/<model>.constraints.json). A storey selector in the bar shows every storey up to the chosen
 * floor, and `?storeys=` shows an exact subset. Every view uses the plan's colours, with the plan's
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
import { STYLES } from "../src/ifc/styles.js";
import { wallHeight } from "../src/geometry/wall.js";
import { renderFloor, renderPlanAnnotations, renderWallTops, roomTags } from "../src/render/plan.js";
import { C, FONT, PX_PER_MM, ROOM_LABEL } from "../src/render/style.js";
import type { BuildingModel, Storey } from "../src/schema/schema.js";
import type { ResolvedConstraint } from "../src/constraints/check.js";
import { constraintLabels } from "./constraints.js";
import { elementLabel, type ElementLabel } from "./identify.js";
import { SNAP_MAX_PX, axisAlignedPoint, isMeasureGesture, measurementLines, measurementSummary, measurementValues, nearestSnap, type MeasurementValues, type Point3, type SnapCandidate } from "./measure.js";
import { cameraForView, labelHeading, parseView, type View } from "./view.js";
import { WALK_AXES, entryPosition, headingBasis, movementOffset, walkRequested, walkStep } from "./walk.js";
declare global {
  interface Window {
    __elmsteadReady?: boolean;
    __elmsteadError?: string;
    /** Increments after a storey choice has been applied and drawn; tests wait on it. */
    __elmsteadStoreyChanges?: number;
    __elmsteadMeasurements?: { id: number; from: Point3; to: Point3; values: MeasurementValues }[];
    __elmsteadHover?: { id: string; name: string | null } | null;
    /** The text lines of each room label, in storey order; tests read it. */
    __elmsteadRoomLabels?: string[][];
  }
}

const params = new URLSearchParams(location.search);
const snapshot = params.has("snapshot");
if (snapshot) document.body.classList.add("snapshot");
const status = document.getElementById("status")!;
const select = document.getElementById("model") as HTMLSelectElement;
const storeySelect = document.getElementById("storeys") as HTMLSelectElement;
const storeyLabel = document.getElementById("storey-label")!;

const components = new OBC.Components();
const world = components.get(OBC.Worlds).create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = new THREE.Color(0xf4f4f2);
world.renderer = new OBC.SimpleRenderer(components, document.getElementById("container")!, { preserveDrawingBuffer: true });
world.renderer.showLogo = false;
const canvas = world.renderer.three.domElement;
world.camera = new OBC.OrthoPerspectiveCamera(components);
components.init();
setNavigationInput();
world.camera.projection.onChanged.add(setNavigationInput);
// A pinch spreading the fingers 4× should zoom about 4×; camera-controls' one dollySpeed also sets
// the wheel's, so pick it per gesture. The container's capture listeners run before the canvas's.
const container = document.getElementById("container")!;
container.addEventListener("pointerdown", (e) => (world.camera.controls.dollySpeed = e.pointerType === "touch" ? 1.5 : 1), { capture: true });
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
});

const ifcLoader = components.get(OBC.IfcLoader);
// Keep IFC coordinates as they are (no shift to the origin) so the room labels line up with the model.
await ifcLoader.setup({ autoSetWasm: false, wasm: { path: "/wasm/", absolute: true }, webIfc: { COORDINATE_TO_ORIGIN: false } });

/** Texture px per plan-SVG px: the SVG is 1 px = 10 mm, so this is 2.5 mm per texel. */
const LABEL_RESOLUTION = 4;
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
const measureMarkerMaterial = new THREE.MeshBasicMaterial({ color: C.measure, depthTest: false, depthWrite: false, transparent: true });

/** The loaded Fragments model, so a storey choice can update it without a reload. */
let currentModel: FragmentsModel | null = null;
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
const compass = document.getElementById("compass")!;
const compassArrow = document.getElementById("compass-arrow")!;
const compassN = document.getElementById("compass-n")!;

/**
 * Turn the compass so its arrow lies along true north as it appears on screen: project a line
 * pointing north from the middle of the ground, so perspective views read the same as the ground.
 */
function updateCompass() {
  compass.hidden = !labels.visible || northAngle === null;
  if (compass.hidden) return;
  const a = (northAngle! * Math.PI) / 180;
  const centre = shownBox().getCenter(new THREE.Vector3()).setY(box.min.y);
  // Plan north (−sin a, cos a) in IFC x/y; the scene has IFC +y along −Z.
  const tip = centre.clone().add(new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)));
  const camera = world.camera.three;
  const [p, q] = [centre.project(camera), tip.project(camera)];
  const { clientWidth: w, clientHeight: h } = world.renderer!.three.domElement;
  const dx = ((q.x - p.x) * w) / 2;
  const dy = (-(q.y - p.y) * h) / 2;
  if (Math.hypot(dx, dy) < 1e-6) return;
  const turn = Math.atan2(dx, -dy); // clockwise from screen up
  compassArrow.setAttribute("transform", `rotate(${(turn * 180) / Math.PI})`);
  // The N stays upright beyond the arrow's tip, as on the plan.
  compassN.setAttribute("x", String(33 * Math.sin(turn)));
  compassN.setAttribute("y", String(-33 * Math.cos(turn) + 5));
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

interface BillboardLine {
  text: string;
  size: number;
  bold?: boolean;
  /** Baseline offset from the label's centre, in canvas px. */
  dy: number;
}

/** A label's haloed canvas, at the plan's text scale; width and height are in canvas px. */
function labelTexture(lines: BillboardLine[], fill: string): { map: THREE.CanvasTexture; width: number; height: number } {
  const halo = 3;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = (l: BillboardLine) => `${l.bold ? "bold " : ""}${l.size}px "${FONT}", sans-serif`;
  const width = Math.max(...lines.map((l) => ((ctx.font = font(l)), ctx.measureText(l.text).width))) + 2 * halo;
  // Lay the baselines out around the centre, so the texture centres on its anchor.
  const top = Math.min(...lines.map((l) => l.dy - l.size));
  const bottom = Math.max(...lines.map((l) => l.dy + 4));
  const height = bottom - top;
  canvas.width = Math.ceil(width * LABEL_RESOLUTION);
  canvas.height = Math.ceil((height + 2 * halo) * LABEL_RESOLUTION);
  ctx.scale(LABEL_RESOLUTION, LABEL_RESOLUTION);
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const l of lines) {
    ctx.font = font(l);
    ctx.lineWidth = halo;
    ctx.strokeStyle = C.paper;
    ctx.strokeText(l.text, width / 2, halo - top + l.dy);
    ctx.fillStyle = fill;
    ctx.fillText(l.text, width / 2, halo - top + l.dy);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, width, height: height + 2 * halo };
}

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
  mesh.userData.flatLabel = true; // updateLabelOrientation rotates these
  return mesh;
}

/** Turn every flat room label within its plane so its text reads left-to-right from the camera. */
function updateLabelOrientation() {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(world.camera.three.quaternion);
  labelYaw.setFromAxisAngle(WORLD_UP, labelHeading(right));
  labels.traverse((obj) => {
    if (obj.userData.flatLabel) obj.quaternion.copy(labelYaw).multiply(FLAT_LABEL_BASE);
  });
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

/** A plan-sized SVG overlay as a flat plane at height `y` (m), the drawing's north along −Z (IFC +Y). */
async function planPlane(svg: string, bounds: { minX: number; minY: number; maxX: number; maxY: number }, y: number, material: THREE.MeshBasicMaterialParameters) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth * LABEL_RESOLUTION;
  canvas.height = img.naturalHeight * LABEL_RESOLUTION;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = world.renderer!.three.capabilities.getMaxAnisotropy();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((bounds.maxX - bounds.minX) / 1000, (bounds.maxY - bounds.minY) / 1000), new THREE.MeshBasicMaterial({ map, ...material }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((bounds.minX + bounds.maxX) / 2000, y, -(bounds.minY + bounds.maxY) / 2000);
  return mesh;
}

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
 * The plan's dimensions for each storey on one transparent texture at its ceiling, each room's
 * name and area on its own flat label there, and that storey's constraints as red labels and
 * dotted spans beside them. The schema has no ceiling height, so the ceiling is the top of the
 * storey's tallest wall. Lying flat, an upper storey's floor occludes a lower storey's labels, as
 * it does its rooms; the room labels yaw with the camera to stay readable.
 */
async function loadLabels(name: string, model: BuildingModel | null, epoch: number) {
  if (epoch !== loadEpoch) return;
  const dispose = (obj: THREE.Object3D) => {
    for (const child of [...obj.children]) dispose(child);
    if (obj instanceof Line2) obj.geometry.dispose(); // the line material is shared by every constraint
    if (obj instanceof THREE.Mesh) obj.geometry.dispose(); // sprites share one geometry
    const material = "material" in obj ? (obj.material as THREE.MeshBasicMaterial | THREE.SpriteMaterial) : undefined;
    material?.map?.dispose();
    material?.dispose();
  };
  for (const obj of [...labels.children, ...constraints.children, ...planLayers.children]) dispose(obj);
  labels.clear();
  constraints.clear();
  planLayers.clear();
  storeyLayers.clear();
  northAngle = null;
  lowestElevation = null;
  modelJson = model;
  window.__elmsteadRoomLabels = [];
  if (!model) return; // no JSON next to the IFC: show the IFC without labels
  northAngle = model.site.northAngle ?? 0;
  const constraintsRes = await fetch(`/out/${name}.constraints.json`);
  if (epoch !== loadEpoch) return;
  const resolved = constraintsRes.ok ? ((await constraintsRes.json()) as ResolvedConstraint[]) : [];
  updateLowestElevation();
  for (const storey of model.storeys) {
    const labelGroup = new THREE.Group();
    const layerGroup = new THREE.Group();
    // Dimensions on one flat plane at the ceiling: lying flat is what lets an upper storey's floor
    // occlude them, which a camera-facing billboard could never be.
    const { svg, bounds } = renderPlanAnnotations(storey, { names: false });
    const ceiling = Math.max(0, ...storey.walls.map((w) => wallHeight(w)));
    const y = (storey.elevation + ceiling + LABEL_LIFT) / 1000;
    const annotations = await planPlane(svg, bounds, y, { transparent: true, depthWrite: false });
    if (epoch !== loadEpoch) return;
    annotations.renderOrder = 1; // over the wall tops' layer
    labelGroup.add(annotations);
    // Each room's name and area is its own plane, flat like the dimensions but yawed to the camera
    // (updateLabelOrientation), so it stays occludable without standing up through the floor above.
    for (const tag of roomTags(storey)) {
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
      labelGroup.add(label);
    }
    const tops = renderWallTops(storey, model.components);
    layerGroup.add(await planPlane(tops.svg, tops.bounds, (storey.elevation + ceiling + WALL_TOP_LIFT) / 1000, { transparent: true, depthWrite: false }));
    if (epoch !== loadEpoch) return;
    // Every storey's floor is its own slab and room fills, at its own level, writing depth: the floor you
    // see is the topmost one, and it hides the storeys below. Cut-out (alphaTest), not blended, so
    // it stays in the opaque pass that runs before the walls. Built even while hidden, so the
    // selector can show a storey again without rebuilding it.
    const fills = renderFloor(storey, model.components);
    const fill = await planPlane(fills.svg, fills.bounds, (storey.elevation + FLOOR_LIFT) / 1000, { alphaTest: 0.5 });
    if (epoch !== loadEpoch) return;
    fill.renderOrder = -1;
    layerGroup.add(fill);
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
    constraints.add(constraintGroup);
    labelGroup.visible = isShown(storey.id);
    layerGroup.visible = isShown(storey.id);
    constraintGroup.visible = isShown(storey.id);
    labels.add(labelGroup);
    planLayers.add(layerGroup);
    storeyLayers.set(storey.id, [labelGroup, layerGroup, constraintGroup]);
  }
  updateLabelOrientation();
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
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const known = ids.filter((id) => model.storeys.some((s) => s.id === id));
  const unknown = ids.filter((id) => !known.includes(id));
  shownStoreys = known.length ? known : null;
  if (unknown.length) storeysNote = ` · no storey ${unknown.map((u) => `"${u}"`).join(", ")}, showing all`;
}

/** The model's storeys, lowest first: the selector's order and a cumulative choice's order. */
const storeysLowestFirst = (model: BuildingModel): Storey[] => [...model.storeys].sort((a, b) => a.elevation - b.elevation);

/** Whether `ids` is every storey up to one floor: the shape the selector writes to `?storeys=`. */
function isStoreyPrefix(ids: string[], ordered: Storey[]): boolean {
  const selected = new Set(ids);
  return ordered.every((s, i) => selected.has(s.id) === (i < ids.length));
}

/** Fill the selector from the model, showing the floor the selection reaches or a custom value. */
function populateStoreySelector(model: BuildingModel | null) {
  const ordered = model ? storeysLowestFirst(model) : [];
  const show = ordered.length > 1;
  storeyLabel.hidden = !show;
  storeySelect.hidden = !show;
  if (!show) {
    storeySelect.replaceChildren();
    return;
  }
  const options = ordered.map((s) => {
    const option = document.createElement("option");
    option.value = s.id;
    option.textContent = s.name;
    return option;
  });
  let top: string | undefined;
  if (shownStoreys !== null && !isStoreyPrefix(shownStoreys, ordered)) {
    // The URL asked for a set no single floor describes; say so until a floor is chosen.
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Custom";
    option.disabled = true;
    option.selected = true;
    options.unshift(option);
  } else {
    const shown = new Set(shownStoreys ?? ordered.map((s) => s.id));
    top = ([...ordered].reverse().find((s) => shown.has(s.id)) ?? ordered[ordered.length - 1]!).id;
  }
  storeySelect.replaceChildren(...options);
  if (top) storeySelect.value = top;
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
  await applyStoreyVisibility(currentModel);
  updateLowestElevation();
  status.textContent = `${select.value}.ifc`;
  // The camera stays put: only the drawings change, so floors compare from one viewpoint.
  await fragments.core.update(true);
  updateCompass();
  repickHover();
}

/**
 * Show exactly the selected storeys through fragments: each item is visible when the storey its Tag
 * — or its Name, for spaces — belongs to is. Items that name no model element are left alone; they
 * carry no geometry. Storey layers follow the same selection, so labels, floors and constraints
 * travel with their storey.
 */
async function applyStoreyVisibility(model: FragmentsModel) {
  const storeyItems = new Map<string, number[]>();
  if (!modelJson) return;
  // Which storey owns each element id, from the model JSON: the IFC is the geometry, but the JSON is
  // the authority on which storey an element belongs to.
  const owner = new Map<string, string>();
  for (const s of modelJson.storeys) {
    for (const w of s.walls) owner.set(w.id, s.id);
    for (const o of s.openings) owner.set(o.id, s.id);
    for (const sl of s.slabs) owner.set(sl.id, s.id);
    for (const r of s.rooms) owner.set(r.id, s.id);
    // Stairs arrive with ELM-4; read them defensively so this mapping is ready for them.
    const stairs = (s as { stairs?: { id: string; segments: { id: string }[] }[] }).stairs ?? [];
    for (const st of stairs) {
      owner.set(st.id, s.id);
      for (const seg of st.segments) owner.set(seg.id, s.id);
    }
  }
  // Fragments' spatial tree does not surface every storey, so map items by their Tag (elements) or
  // Name (spaces, whose Tag the writer leaves empty) instead of walking it.
  const items = await model.getItems();
  for (const [localId, item] of items) {
    const key = (item.data.Tag?.value ?? item.data.Name?.value) as string | undefined;
    const storey = key ? owner.get(key) : undefined;
    if (!storey) continue;
    storeyItems.set(storey, [...(storeyItems.get(storey) ?? []), localId]);
  }
  for (const [storey, ids] of storeyItems) await model.setVisible(ids, isShown(storey));
  for (const [id, groups] of storeyLayers) for (const g of groups) g.visible = isShown(id);
}

/** Bounding box of the shown storeys' plan geometry, so the walk pose centres on what is visible. */
function shownBox(): THREE.Box3 {
  if (!modelJson) return box;
  const pts = modelJson.storeys.filter((s) => isShown(s.id)).flatMap((s) => [
    ...s.walls.flatMap((w) => [w.start, w.end]),
    ...s.slabs.flatMap((sl) => sl.outline),
    ...s.rooms.flatMap((r) => r.outline),
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
const styleParam = params.get("style"); // ?style=ifc|plan overrides the default
const style: Style = styleParam === "ifc" || styleParam === "plan" ? styleParam : snapshot ? "ifc" : "plan";

/** Which of the IFC's presentation colours (src/ifc/styles.ts) a material carries, if any. */
function styleOf(material: THREE.MeshLambertMaterial): keyof typeof STYLES | undefined {
  const c = material.color;
  let best: keyof typeof STYLES | undefined;
  let bestDist = 0.02; // the IFC colours survive the round trip to within about 1/255
  for (const [name, { rgb }] of Object.entries(STYLES) as [keyof typeof STYLES, (typeof STYLES)[keyof typeof STYLES]][]) {
    const ifc = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
    const d = Math.hypot(ifc.r - c.r, ifc.g - c.g, ifc.b - c.b);
    if (d < bestDist) [best, bestDist] = [name, d];
  }
  return best;
}

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
function applyStyle() {
  const plan = style === "plan";
  if (plan) {
    for (const m of fragments.core.models.materials.list.values()) {
      if (!(m instanceof THREE.MeshLambertMaterial)) continue;
      const name = styleOf(m);
      if (name === "wall") patchTops(m, 1);
      if (name === "slab" || name === "ground") patchTops(m, 2);
    }
  }
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
const stairWall = new THREE.Color().setRGB(STYLES.wall.rgb[0], STYLES.wall.rgb[1], STYLES.wall.rgb[2], THREE.SRGBColorSpace);
let stairRiser = 0; // metres, set from the model on load
function patchStairBands(m: THREE.MeshLambertMaterial) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRiser = { value: stairRiser };
    shader.uniforms.uCream = { value: stairCream };
    shader.uniforms.uCreamDark = { value: stairCreamDark };
    shader.uniforms.uWall = { value: stairWall };
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying float vWorldY;\nvarying vec3 vWorldN;\nvoid main() {")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWorldY = (modelMatrix * vec4(position, 1.0)).y;\nvWorldN = normalize(mat3(modelMatrix) * normal);");
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform float uRiser;\nuniform vec3 uCream;\nuniform vec3 uCreamDark;\nuniform vec3 uWall;\nvarying float vWorldY;\nvarying vec3 vWorldN;\nvoid main() {")
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

function disposeStairMeshes() {
  for (const s of stairMeshes) s.edges.geometry.dispose();
  stairMeshes = [];
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
      const tops = shown.flatMap((s) => [s.elevation, ...s.walls.map((w) => s.elevation + wallHeight(w)), ...s.slabs.map((sl) => s.elevation + sl.elevationOffset)]);
      const bottoms = shown.flatMap((s) => [s.elevation, ...s.slabs.map((sl) => s.elevation + sl.elevationOffset - sl.thickness)]);
      frame.min.y = Math.min(...bottoms) / 1000;
      frame.max.y = Math.max(...tops) / 1000;
    }
  }
  const centre = frame.getCenter(new THREE.Vector3());
  const { direction, projection } = cameraForView(view, snapshot);
  await world.camera.projection.set(projection);
  // Start well outside the model, then fit to its bounding sphere: fitToSphere keeps the viewing
  // direction (fitToBox would snap to the nearest face).
  const sphere = frame.getBoundingSphere(new THREE.Sphere());
  const d = new THREE.Vector3(...direction).normalize().multiplyScalar(sphere.radius * 4);
  await world.camera.controls.setLookAt(centre.x + d.x, centre.y + d.y, centre.z + d.z, centre.x, centre.y, centre.z, false);
  // Top looks straight down the height, so its sphere is loose and takes a tighter factor; the
  // corner views fit the whole sphere plus a little air, so no corner of the building is cropped.
  // Interactive views sit a touch looser than the snapshots the PNGs were rendered with.
  sphere.radius *= view === "top" ? (snapshot ? 0.78 : 1) : snapshot ? 0.92 : 1.1;
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
  if (v.length !== 6 || v.some((n) => !Number.isFinite(n))) throw new Error(`?camera needs six numbers, got "${spec}"`);
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
const walkButton = document.getElementById("walk") as HTMLButtonElement;
const walkHint = document.getElementById("walk-hint")!;
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
      walkHint.hidden = true;
    });
    pointerLockControls.addEventListener("unlock", () => {
      // Escape is the browser's pointer-lock release, so unlocking performs the exit — but only
      // an unlock after a successful lock, so a refused request keeps walk mode.
      if (everLocked) void exitWalk();
    });
  }
  everLocked = false;
  walkButton.setAttribute("aria-pressed", "true");
  walkHint.hidden = false;
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
  walkButton.setAttribute("aria-pressed", "false");
  walkHint.hidden = true;
  status.textContent = `${select.value}.ifc`;
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
  const next = walkStep(camera.position, headingBasis(camera.getWorldDirection(walkDirection)), movementOffset(walkKeys), (now - walkLast) / 1000, walkEyeY);
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

walkButton.addEventListener("click", () => {
  if (savedView) void exitWalk();
  else void enterWalk(true);
});
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
  walkHint.hidden = false;
  status.textContent = "pointer lock refused — click to retry; WASD still moves, Esc leaves";
});

const measureButton = document.getElementById("measure") as HTMLButtonElement;
const clearButton = document.getElementById("clear") as HTMLButtonElement;
const measureHint = document.getElementById("measure-hint")!;
const measureList = document.getElementById("measure-list") as HTMLOListElement;

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
    measurementLines(id, values).map((text, i) => ({ text, size: i === 0 ? 12 : 11, bold: i === 0, dy: (i - 1) * step })),
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
  for (const obj of measureLayer.children) {
    if (obj instanceof Line2) obj.geometry.dispose();
    else if (obj instanceof THREE.Sprite) {
      obj.material.map?.dispose();
      obj.material.dispose();
    }
  }
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
  measureList.replaceChildren(
    ...measurements.map((m) => {
      const row = document.createElement("li");
      row.textContent = measurementSummary(m.id, m.values);
      return row;
    }),
  );
  measureList.hidden = measurements.length === 0;
}

function updateClearButton() {
  clearButton.disabled = measurements.length === 0 && pendingPoint === null;
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
  document.body.classList.toggle("measuring", on);
  measureButton.setAttribute("aria-pressed", String(on));
  measureHint.hidden = !on;
}

/** The snapped or face point under a client-space position, in scene metres. */
async function pickAt(x: number, y: number): Promise<THREE.Vector3 | null> {
  const model = currentModel;
  if (!model) return null;
  const camera = world.camera.three;
  const mouse = new THREE.Vector2(x, y);
  const results = await model.raycastWithSnapping({ camera, mouse, dom: canvas, snappingClasses: [SnappingClass.POINT, SnappingClass.LINE] });
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

measureButton.setAttribute("aria-pressed", "false");
measureButton.addEventListener("click", async () => {
  if (measuring) {
    setMeasuring(false);
    return;
  }
  await exitWalk();
  setMeasuring(true);
});
clearButton.addEventListener("click", () => clearMeasurements());
window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape" || !measuring || snapshot) return;
  if (pendingPoint) cancelPending();
  else setMeasuring(false);
});
updateMeasureUi();

const idsButton = document.getElementById("ids") as HTMLButtonElement;
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
  hoverSprite.material.map?.dispose();
  hoverSprite.material.dispose();
  hoverSprite = null;
}

function hideHover() {
  disposeHoverSprite();
  window.__elmsteadHover = null;
}

function setIdentifying(on: boolean) {
  identifying = on;
  idsButton.setAttribute("aria-pressed", String(on));
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
      const hit = await model.raycast({ camera: world.camera.three, mouse: new THREE.Vector2(next.x, next.y), dom: canvas });
      if (epoch !== hoverEpoch || currentModel !== model || !identifying || savedView) continue;
      const label = hit ? elementLabels.get(hit.localId) : undefined;
      if (!hit || !label) {
        hideHover();
        continue;
      }
      window.__elmsteadHover = { id: label.id, name: label.name };
      // Constraint-label styling, but depth-untested like the measurement readout: on top of everything.
      if (!hoverSprite || hoverSprite.userData.id !== label.id) {
        disposeHoverSprite();
        const texts = label.name ? [label.id, label.name] : [label.id];
        hoverSprite = billboard(
          texts.map((text, i) => ({ text, size: 11, bold: true, dy: (i - (texts.length - 1) / 2) * 14 })),
          C.constraint,
          11,
          false,
        );
        hoverSprite.userData.id = label.id;
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
idsButton.setAttribute("aria-pressed", "false");
idsButton.addEventListener("click", () => setIdentifying(!identifying));

async function discardModel(model: FragmentsModel) {
  if (currentModel === model) currentModel = null;
  try {
    await fragments.core.disposeModel(model.modelId);
  } catch {
    // a newer load may already have disposed it
  }
}

async function load(name: string) {
  const epoch = ++loadEpoch;
  currentModel = null;
  hoverEpoch++;
  hideHover();
  elementLabels.clear();
  clearMeasurements();
  status.textContent = `loading ${name}.ifc…`;
  disposeStairMeshes();
  for (const [id] of fragments.list) await fragments.core.disposeModel(id);
  if (epoch !== loadEpoch) return;
  const buffer = new Uint8Array(await (await fetch(`/out/${name}.ifc`)).arrayBuffer());
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
  const model = await ifcLoader.load(buffer, true, name);
  if (epoch !== loadEpoch) {
    await discardModel(model);
    return;
  }
  model.useCamera(world.camera.three);
  // Always full geometry. By default Fragments draws items it judges small on screen as lines (its
  // LOD), and glazing bars and window frames qualify even close up: they showed as thin lines you
  // could see through. Our models are small enough not to need it.
  await model.setLodMode(LodMode.ALL_VISIBLE);
  if (epoch !== loadEpoch) {
    await discardModel(model);
    return;
  }
  world.scene.three.add(model.object);
  currentModel = model;
  await fragments.core.update(true);
  if (epoch !== loadEpoch) {
    await discardModel(model);
    return;
  }
  for (const [localId, item] of await model.getItems()) {
    const label = elementLabel(item.data);
    if (label) elementLabels.set(localId, label);
  }
  if (epoch !== loadEpoch) {
    await discardModel(model);
    return;
  }
  await loadLabels(name, json, epoch);
  if (epoch !== loadEpoch) {
    await discardModel(model);
    return;
  }
  await applyStoreyVisibility(model);
  if (epoch !== loadEpoch) return;
  applyStyle();
  addStairEdges(model);
  applyStairPresentation();
  box = model.box.clone();
  grid.three.position.y = box.min.y - 0.01; // under the lowest slab, so it doesn't show through floors
  await setView(parseView(params.get("view"))); // the plan view, unless the URL asks for another
  if (epoch !== loadEpoch) return;
  if (params.get("camera")) await setCamera(params.get("camera")!);
  if (epoch !== loadEpoch) return;
  status.textContent = `${name}.ifc${storeysNote}`;
  repickHover();
}

const labelsButton = document.getElementById("labels") as HTMLButtonElement;
labelsButton.setAttribute("aria-pressed", String(labels.visible));
labelsButton.addEventListener("click", () => {
  labels.visible = !labels.visible;
  labelsButton.setAttribute("aria-pressed", String(labels.visible));
  updateCompass();
});

const constraintsButton = document.getElementById("constraints") as HTMLButtonElement;
constraintsButton.setAttribute("aria-pressed", String(constraints.visible));
constraintsButton.addEventListener("click", () => {
  constraints.visible = !constraints.visible;
  constraintsButton.setAttribute("aria-pressed", String(constraints.visible));
});

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
  b.addEventListener("click", async () => {
    await exitWalk(); // choosing a view leaves walk mode before the view changes
    await setView(parseView(b.dataset.view ?? null));
  }),
);
storeySelect.addEventListener("change", async () => {
  await chooseStorey(storeySelect.value);
  requestAnimationFrame(() => requestAnimationFrame(() => (window.__elmsteadStoreyChanges = (window.__elmsteadStoreyChanges ?? 0) + 1)));
});
select.addEventListener("change", async () => {
  await exitWalk();
  params.set("model", select.value);
  history.replaceState(null, "", `?${params}`);
  void load(select.value);
});

try {
  const models: string[] = await (await fetch("/models.json")).json();
  if (!models.length) throw new Error("no IFC files in out/ — run npm run build <model> first");
  select.replaceChildren(
    ...models.map((m) => {
      const option = document.createElement("option");
      option.value = m;
      option.textContent = m;
      return option;
    }),
  );
  select.value = params.get("model") ?? models[0]!;
  await load(select.value);
  if (idsRequested) setIdentifying(true);
  // `?walk=1` and `?measure=1` apply once, at startup; a model change leaves both modes alone.
  // Walk wins when both are present.
  if (walkRequested(params, snapshot)) void enterWalk(false);
  else if (measureRequested) setMeasuring(true);
  // Two frames so the renderer has drawn the final camera position before a snapshot.
  requestAnimationFrame(() => requestAnimationFrame(() => (window.__elmsteadReady = true)));
} catch (e) {
  status.textContent = String(e);
  window.__elmsteadError = String(e);
}
