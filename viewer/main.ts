/**
 * Local IFC viewer on That Open Engine: loads out/<model>.ifc, converts it to Fragments in the
 * browser and shows it, with the plan's room dimensions at each storey's ceiling and room names on
 * billboards that face the camera, and a compass pointing to true north (all from
 * out/<model>.building.json). Every view uses the plan's colours, with the plan's walls, doors and
 * windows laid on the wall tops, so the Top view reads like the plan. Query params: ?model=<name>&view=<sw|se|ne|nw|top (default)>&snapshot=1
 * &labels=0|1&style=plan|ifc&camera=px,py,pz,tx,ty,tz&walk=1 (snapshot hides the UI and sets window.__elmsteadReady once the first
 * frame is drawn; labels and the plan style are on by default, except in snapshots, which show the
 * IFC alone; walk=1 enters first-person walk mode, which snapshots ignore).
 */
import * as OBC from "@thatopen/components";
import { LodMode } from "@thatopen/fragments";
import workerUrl from "@thatopen/fragments/worker?url";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { STYLES } from "../src/ifc/styles.js";
import { renderFloor, renderPlanAnnotations, renderWallTops, roomTags } from "../src/render/plan.js";
import { C, FONT, PX_PER_MM, ROOM_LABEL } from "../src/render/style.js";
import type { BuildingModel } from "../src/schema/schema.js";
import { WALK_AXES, entryPosition, headingBasis, movementOffset, walkRequested, walkStep } from "./walk.js";

type View = "sw" | "se" | "ne" | "nw" | "top";
declare global {
  interface Window {
    __elmsteadReady?: boolean;
    __elmsteadError?: string;
  }
}

const params = new URLSearchParams(location.search);
const snapshot = params.has("snapshot");
if (snapshot) document.body.classList.add("snapshot");
const status = document.getElementById("status")!;
const select = document.getElementById("model") as HTMLSelectElement;

const components = new OBC.Components();
const world = components.get(OBC.Worlds).create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = new THREE.Color(0xf4f4f2);
world.renderer = new OBC.SimpleRenderer(components, document.getElementById("container")!, { preserveDrawingBuffer: true });
world.camera = new OBC.OrthoPerspectiveCamera(components);
components.init();
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

/** True north, degrees counter-clockwise from plan +y (site.northAngle); null when there is no model JSON. */
let northAngle: number | null = null;
/** The lowest storey's elevation in scene metres, from the model JSON; null when there is none. */
let lowestElevation: number | null = null;
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
  const centre = box.getCenter(new THREE.Vector3()).setY(box.min.y);
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
window.addEventListener("resize", updateCompass);

/** A room's name and area as a sprite, which always faces the camera, at the plan's text size. */
function roomBillboard(name: string, area: string): THREE.Sprite {
  const lines = [
    { text: name, font: `bold ${ROOM_LABEL.name.size}px "${FONT}", sans-serif`, dy: ROOM_LABEL.name.dy },
    { text: area, font: `${ROOM_LABEL.area.size}px "${FONT}", sans-serif`, dy: ROOM_LABEL.area.dy },
  ];
  const halo = 3;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const width = Math.max(...lines.map((l) => ((ctx.font = l.font), ctx.measureText(l.text).width))) + 2 * halo;
  // Same layout as the plan: baselines at dy from the centroid, which is the sprite's centre.
  const top = ROOM_LABEL.name.dy - ROOM_LABEL.name.size - halo;
  const bottom = ROOM_LABEL.area.dy + 4 + halo;
  const half = Math.max(-top, bottom); // symmetric about the centroid, so the sprite centres on it
  canvas.width = Math.ceil(width * LABEL_RESOLUTION);
  canvas.height = Math.ceil(2 * half * LABEL_RESOLUTION);
  ctx.scale(LABEL_RESOLUTION, LABEL_RESOLUTION);
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const l of lines) {
    ctx.font = l.font;
    ctx.lineWidth = halo;
    ctx.strokeStyle = C.paper;
    ctx.strokeText(l.text, width / 2, half + l.dy);
    ctx.fillStyle = C.ink;
    ctx.fillText(l.text, width / 2, half + l.dy);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  // Always drawn over the model: it stands up from the ceiling, so wall tops would cut its lower half.
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false }));
  sprite.renderOrder = 2; // over the dimensions
  const mPerPx = 1 / PX_PER_MM / 1000;
  sprite.scale.set(width * mPerPx, 2 * half * mPerPx, 1);
  return sprite;
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
 * Plan colouring's layers (see applyStyle): the plan's room fills and door swings standing in for
 * the slab's top face, and the plan's walls, door gaps and windows laid over the wall tops.
 */
const planLayers = new THREE.Group();
planLayers.visible = false;
world.scene.three.add(planLayers);
/** Height (mm) above the wall tops of the plan's walls, door gaps and windows; below the labels. */
const WALL_TOP_LIFT = 5;

/**
 * The plan's room dimensions for each storey, as a transparent texture on a plane at the ceiling,
 * and each room's name and area on a billboard above its centre. The schema has no ceiling height,
 * so the ceiling is the top of the storey's tallest wall.
 */
async function loadLabels(name: string) {
  for (const obj of [...labels.children, ...planLayers.children] as (THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | THREE.Sprite)[]) {
    if (obj instanceof THREE.Mesh) obj.geometry.dispose(); // sprites share one geometry
    obj.material.map?.dispose();
    obj.material.dispose();
  }
  labels.clear();
  planLayers.clear();
  northAngle = null;
  lowestElevation = null;
  const res = await fetch(`/out/${name}.building.json`);
  if (!res.ok) return; // no JSON next to the IFC: show the IFC without labels
  const model = (await res.json()) as BuildingModel;
  northAngle = model.site.northAngle ?? 0;
  const lowest = model.storeys.reduce((a, b) => (b.elevation < a.elevation ? b : a));
  lowestElevation = lowest.elevation / 1000; // the JSON is millimetres, the scene metres
  for (const storey of model.storeys) {
    const { svg, bounds } = renderPlanAnnotations(storey, { names: false });
    const ceiling = Math.max(0, ...storey.walls.map((w) => w.height));
    const y = (storey.elevation + ceiling + LABEL_LIFT) / 1000;
    const annotations = await planPlane(svg, bounds, y, { transparent: true, depthWrite: false });
    annotations.renderOrder = 1; // over the wall tops' layer
    labels.add(annotations);
    const tops = renderWallTops(storey, model.components);
    planLayers.add(await planPlane(tops.svg, tops.bounds, (storey.elevation + ceiling + WALL_TOP_LIFT) / 1000, { transparent: true, depthWrite: false }));
    // Only the lowest storey's floor: drawn without depth, an upper floor's would show through
    // the storeys below it.
    if (storey === lowest) {
      // Drawn first and without depth, so the model always covers it; cut-out (alphaTest), not
      // blended, so it stays in the opaque pass that runs before the walls.
      const fills = renderFloor(storey);
      const fill = await planPlane(fills.svg, fills.bounds, storey.elevation / 1000, { alphaTest: 0.5, depthTest: false, depthWrite: false });
      fill.renderOrder = -1;
      planLayers.add(fill);
    }
    for (const tag of roomTags(storey)) {
      const sprite = roomBillboard(tag.name, tag.area);
      sprite.position.set(tag.at.x / 1000, y, -tag.at.y / 1000);
      labels.add(sprite);
    }
  }
}

let box = new THREE.Box3();

/**
 * Plan colouring, in every view except snapshots (which show the IFC's own colours):
 *
 * - Floors: the slab's top face is not drawn; the plan's own room fills and door swings are drawn
 *   first, without depth, so the model always covers them. (A wall's underside lies exactly on the slab's top
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
 * Patch a material so its upward faces are drawn in the plan's wall colour (`mode` 1) or not at
 * all (`mode` 2).
 */
function patchTops(m: THREE.MeshLambertMaterial, mode: 1 | 2) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.planTopColour = { value: wallTop };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 planTopColour;\nvoid main() {")
      // `normal` is view-space; `normal * mat3(viewMatrix)` is the world-space normal (the view
      // matrix is orthonormal).
      .replace(
        "#include <opaque_fragment>",
        `if ((normal * mat3(viewMatrix)).y > 0.7) {
          ${mode === 2 ? "discard;" : "outgoingLight = planTopColour;"}
        }
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
      if (name === "slab") patchTops(m, 2);
    }
  }
  world.scene.three.background = new THREE.Color(plan ? C.paper : 0xf4f4f2);
  grid.three.visible = !plan;
  planLayers.visible = plan;
}

/** Three.js is Y-up with plan north along −Z (IFC +Y). */
async function setView(view: View) {
  const centre = box.getCenter(new THREE.Vector3());
  const dir: Record<View, [number, number, number]> = {
    sw: [-1, 0.7, 1],
    se: [1, 0.7, 1],
    ne: [1, 0.7, -1],
    nw: [-1, 0.7, -1],
    top: [0, 1, 0.0001],
  };
  // Top is a true orthographic plan view; the corner views are perspective.
  await world.camera.projection.set(view === "top" ? "Orthographic" : "Perspective");
  // Start well outside the model, then fit to its bounding sphere: fitToSphere keeps the viewing
  // direction (fitToBox would snap to the nearest face).
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const d = new THREE.Vector3(...dir[view]).normalize().multiplyScalar(sphere.radius * 4);
  await world.camera.controls.setLookAt(centre.x + d.x, centre.y + d.y, centre.z + d.z, centre.x, centre.y, centre.z, false);
  sphere.radius *= view === "top" ? 0.78 : 0.92; // the sphere is loose around a flat box; tighten the framing
  await world.camera.controls.fitToSphere(sphere, false);
  await fragments.core.update(true);
  updateCompass();
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
}

/** The camera state walk mode saves on entry and restores on exit; non-null while walking. */
interface SavedView {
  projection: "Orthographic" | "Perspective";
  position: THREE.Vector3;
  target: THREE.Vector3;
  ortho: { left: number; right: number; top: number; bottom: number; zoom: number };
  near: number;
}
/** The perspective near plane while walking: OBC's default 1 m would clip every wall within arm's reach. */
const WALK_NEAR = 0.05;
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
  const controls = world.camera.controls;
  const ortho = world.camera.threeOrtho;
  savedView = {
    projection: world.camera.projection.current,
    position: controls.getPosition(new THREE.Vector3()),
    target: controls.getTarget(new THREE.Vector3()),
    ortho: { left: ortho.left, right: ortho.right, top: ortho.top, bottom: ortho.bottom, zoom: ortho.zoom },
    near: world.camera.threePersp.near,
  };
  const start = entryPosition(box, lowestElevation);
  walkEyeY = start.y;
  await world.camera.projection.set("Perspective");
  world.camera.enabled = false;
  controls.enabled = false;
  const camera = world.camera.three;
  camera.near = WALK_NEAR;
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

async function load(name: string) {
  status.textContent = `loading ${name}.ifc…`;
  for (const [id] of fragments.list) await fragments.core.disposeModel(id);
  const buffer = new Uint8Array(await (await fetch(`/out/${name}.ifc`)).arrayBuffer());
  const model = await ifcLoader.load(buffer, true, name);
  model.useCamera(world.camera.three);
  // Always full geometry. By default Fragments draws items it judges small on screen as lines (its
  // LOD), and glazing bars and window frames qualify even close up: they showed as thin lines you
  // could see through. Our models are small enough not to need it.
  await model.setLodMode(LodMode.ALL_VISIBLE);
  world.scene.three.add(model.object);
  await fragments.core.update(true);
  await loadLabels(name);
  applyStyle();
  box = model.box.clone();
  grid.three.position.y = box.min.y - 0.01; // under the lowest slab, so it doesn't show through floors
  await setView((params.get("view") as View) ?? "top"); // the plan view, unless the URL asks for another
  if (params.get("camera")) await setCamera(params.get("camera")!);
  status.textContent = `${name}.ifc`;
}

const labelsButton = document.getElementById("labels") as HTMLButtonElement;
labelsButton.setAttribute("aria-pressed", String(labels.visible));
labelsButton.addEventListener("click", () => {
  labels.visible = !labels.visible;
  labelsButton.setAttribute("aria-pressed", String(labels.visible));
  updateCompass();
});

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
  b.addEventListener("click", async () => {
    await exitWalk(); // choosing a view leaves walk mode before the view changes
    await setView(b.dataset.view as View);
  }),
);
select.addEventListener("change", async () => {
  await exitWalk();
  params.set("model", select.value);
  history.replaceState(null, "", `?${params}`);
  void load(select.value);
});

try {
  const models: string[] = await (await fetch("/models.json")).json();
  if (!models.length) throw new Error("no IFC files in out/ — run npm run build <model> first");
  select.innerHTML = models.map((m) => `<option>${m}</option>`).join("");
  select.value = params.get("model") ?? models[0]!;
  await load(select.value);
  // `?walk=1` enters walk mode once, with the click-to-look prompt instead of an immediate lock;
  // a model change does not re-enter.
  if (walkRequested(params, snapshot)) void enterWalk(false);
  // Two frames so the renderer has drawn the final camera position before a snapshot.
  requestAnimationFrame(() => requestAnimationFrame(() => (window.__elmsteadReady = true)));
} catch (e) {
  status.textContent = String(e);
  window.__elmsteadError = String(e);
}
