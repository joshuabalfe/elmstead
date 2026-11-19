/**
 * Local IFC viewer on That Open Engine: loads out/<model>.ifc, converts it to Fragments in the
 * browser and shows it. Query params: ?model=<name>&view=<sw|se|ne|nw|top>&snapshot=1
 * (snapshot hides the UI and sets window.__elmsteadReady once the first frame is drawn).
 */
import * as OBC from "@thatopen/components";
import workerUrl from "@thatopen/fragments/worker?url";
import * as THREE from "three";

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
await ifcLoader.setup({ autoSetWasm: false, wasm: { path: "/wasm/", absolute: true } });

let box = new THREE.Box3();

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
}

async function load(name: string) {
  status.textContent = `loading ${name}.ifc…`;
  for (const [id] of fragments.list) await fragments.core.disposeModel(id);
  const buffer = new Uint8Array(await (await fetch(`/out/${name}.ifc`)).arrayBuffer());
  const model = await ifcLoader.load(buffer, true, name);
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  await fragments.core.update(true);
  box = model.box.clone();
  grid.three.position.y = box.min.y - 0.01; // under the lowest slab, so it doesn't show through floors
  await setView((params.get("view") as View) ?? "sw");
  status.textContent = `${name}.ifc`;
}

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
  b.addEventListener("click", () => setView(b.dataset.view as View)),
);
select.addEventListener("change", () => {
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
  // Two frames so the renderer has drawn the final camera position before a snapshot.
  requestAnimationFrame(() => requestAnimationFrame(() => (window.__elmsteadReady = true)));
} catch (e) {
  status.textContent = String(e);
  window.__elmsteadError = String(e);
}
