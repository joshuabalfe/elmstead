/**
 * The viewer's presentation: plan colouring's shader patches on the IFC's materials, the stair
 * tread banding and edge outlines, and the plan-style background and grid. Snapshot mode keeps the
 * IFC's own colours unless `?style=` says otherwise.
 */
import type { FragmentsModel } from "@thatopen/fragments";
import * as THREE from "three";
import { STYLES } from "../../shared/ifc/styles.js";
import { C } from "../../shared/render/style.js";
import type { BuildingModel } from "../../shared/schema/schema.js";
import type { SceneContext } from "./context.js";
import { stairBandRiser } from "./stair-bands.js";
import { styleOfColour } from "./style-of.js";

export interface StairMesh {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
}

export interface Style {
  /** Set the one riser all stairs band on, from the model JSON. */
  setModel(model: BuildingModel | null): void;
  /** Re-apply the presentation to every material, the background, the grid and the plan layers. */
  apply(): void;
  /** The presentation of one material, by the IFC colour it carries. */
  patchMaterial(m: THREE.MeshLambertMaterial): void;
  /** Add an edge outline to each stair mesh, into `meshes` so it is disposed with the model. */
  addStairEdges(model: FragmentsModel, meshes: StairMesh[]): void;
  /** Re-patch the stair materials and show the loaded model's stair edges. */
  applyStairPresentation(meshes: readonly StairMesh[]): void;
}

type Presentation = "ifc" | "plan";

export function createStyle(ctx: SceneContext, grid: THREE.Object3D): Style {
  const styleParam = ctx.params.get("style"); // ?style=ifc|plan overrides the default
  const style: Presentation =
    styleParam === "ifc" || styleParam === "plan" ? styleParam : ctx.snapshot ? "ifc" : "plan";

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

  /** The viewer's presentation on one material, by the IFC colour it carries: plan-style tops, stair bands. */
  function patchMaterial(m: THREE.MeshLambertMaterial) {
    const name = styleOf(m);
    if (style === "plan" && name === "wall") patchTops(m, 1);
    if (style === "plan" && (name === "slab" || name === "ground")) patchTops(m, 2);
    if (name === "stair") patchStairBands(m);
  }

  function patchStairMaterials() {
    for (const m of ctx.fragments.core.models.materials.list.values()) {
      if (m instanceof THREE.MeshLambertMaterial && styleOf(m) === "stair") patchStairBands(m);
    }
  }

  function apply() {
    const plan = style === "plan";
    for (const m of ctx.fragments.core.models.materials.list.values())
      if (m instanceof THREE.MeshLambertMaterial) patchMaterial(m);
    patchStairMaterials();
    ctx.scene.background = new THREE.Color(plan ? C.paper : 0xf4f4f2);
    grid.visible = !plan;
    ctx.setPlanVisible(plan);
  }

  function addStairEdges(model: FragmentsModel, meshes: StairMesh[]) {
    model.object.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const m = obj.material;
      if (!(m instanceof THREE.MeshLambertMaterial) || styleOf(m) !== "stair") return;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(obj.geometry, 30), stairEdgeMaterial);
      obj.add(edges);
      meshes.push({ mesh: obj, edges });
    });
  }

  function applyStairPresentation(meshes: readonly StairMesh[]) {
    patchStairMaterials();
    for (const s of meshes) s.edges.visible = true;
  }

  function setModel(model: BuildingModel | null) {
    stairRiser = stairBandRiser(model);
  }

  return { setModel, apply, patchMaterial, addStairEdges, applyStairPresentation };
}
