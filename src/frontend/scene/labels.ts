/**
 * The scene's plan-derived drawings: each storey's room names and dimensions lying flat at its
 * ceiling, the plan's wall tops and floor fills, the constraints as red labels and dotted spans,
 * and the Diff's own plan layers. It owns those groups and the flat labels' camera-facing yaw; the
 * engine owns the model, the storey selection and the site angles.
 */
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { ResolvedConstraint } from "../../shared/constraints/types.js";
import { wallHeight } from "../../shared/geometry/wall.js";
import {
  renderFloor,
  renderPlanAnnotations,
  renderWallTops,
  roomTags,
  type Overlay,
} from "../../shared/render/plan.js";
import { C, PX_PER_MM, ROOM_LABEL } from "../../shared/render/style.js";
import type { BuildingModel, Storey } from "../../shared/schema/schema.js";
import {
  diffFloor,
  doorSwings,
  floorChange,
  floorOutlines,
  floorPieces,
  recolourPlan,
  removedPlan,
} from "../lib/diff.js";
import { labelHeading } from "../lib/view.js";
import { billboard } from "./billboard.js";
import { constraintLabels } from "./constraints.js";
import type { SceneContext } from "./context.js";
import { disposeTree } from "./dispose.js";
import { FLOOR_LIFT, LABEL_LIFT, WALL_TOP_LIFT } from "./lifts.js";
import { overlayGroup, type OverlayLayer } from "./overlay.js";
import { labelTexture, type BillboardLine } from "./text.js";

export interface Labels {
  /** Frees and empties the label, constraint and plan layers, ready for the next model. */
  clear(): void;
  /** The model's resolved constraints, or none when the file is absent. */
  constraints(name: string): Promise<ResolvedConstraint[]>;
  /** One storey's labels, plan layers and constraints, each in its own group. */
  build(model: BuildingModel, resolved: readonly ResolvedConstraint[]): void;
  /** Turn every flat room label within its plane so its text reads left-to-right from the camera. */
  updateOrientation(): void;
  storeyLayers(): Map<string, THREE.Group[]>;
  planLayers(): THREE.Group;
  constraintLineMaterial(): LineMaterial;
  labelsVisible(): boolean;
  constraintsVisible(): boolean;
  setLabelsVisible(on: boolean): void;
  setConstraintsVisible(on: boolean): void;
  setPlanVisible(on: boolean): void;
}

export function createLabels(ctx: SceneContext): Labels {
  const labels = new THREE.Group();
  labels.visible = ctx.params.get("labels") === "1" || (!ctx.snapshot && ctx.params.get("labels") !== "0");
  ctx.scene.add(labels);
  /** Constraint labels and dotted spans, off until the Constraints button or `?constraints=1`. */
  const constraints = new THREE.Group();
  constraints.visible = ctx.params.get("constraints") === "1";
  ctx.scene.add(constraints);
  /** The plan's floor fills and wall tops; hidden outside plan style. */
  const planLayers = new THREE.Group();
  planLayers.visible = false;
  ctx.scene.add(planLayers);
  /** The label and plan-layer groups drawn for each storey, so hiding it takes its drawings with it. */
  const storeyLayers = new Map<string, THREE.Group[]>();

  /** Lays a flat label's texture up along plan north, on the floor plane before any heading yaw. */
  const FLAT_LABEL_BASE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const labelYaw = new THREE.Quaternion();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  /** Every flat label, so orienting them on a camera update need not traverse the whole label tree. */
  const flatLabels: THREE.Mesh[] = [];

  /**
   * A label lying flat on a ceiling, at the plan's text scale, so an upper storey's floor can hide
   * it. `updateOrientation` yaws it about its anchor so it reads across the screen.
   */
  function flatLabel(lines: BillboardLine[], fill: string, renderOrder: number): THREE.Mesh {
    const { map, width, height } = labelTexture(lines, fill);
    map.anisotropy = ctx.renderer.three.capabilities.getMaxAnisotropy();
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
  function updateOrientation() {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(ctx.camera.three.quaternion);
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
    overlayGroup(nodes, bounds, y, layer, ctx.renderer.three.capabilities.getMaxAnisotropy());

  /** Frees and empties the label, constraint and plan layers, ready for the next model. */
  function clear() {
    const shared = new Set([constraintLineMaterial]); // every constraint line shares one material
    for (const obj of [...labels.children, ...constraints.children, ...planLayers.children]) disposeTree(obj, shared);
    labels.clear();
    constraints.clear();
    planLayers.clear();
    storeyLayers.clear();
    flatLabels.length = 0;
  }

  async function constraintsOf(name: string): Promise<ResolvedConstraint[]> {
    const res = await fetch(`/out/${name}.constraints.json`);
    return res.ok ? ((await res.json()) as ResolvedConstraint[]) : [];
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
    for (const g of groups) g.visible = ctx.isShown(storey.id);
    return groups;
  }

  /**
   * Each room's name and area as its own plane at height `y`, flat like the dimensions but yawed to
   * the camera (updateOrientation), so it stays occludable without standing up through the floor
   * above. Also records each label for the test hook.
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
    const diff = ctx.shownDiff();
    return [...byHeight].map(([h, walls]) => {
      const ids = new Set(walls.map((w) => w.id));
      const groupStorey = { ...storey, walls, openings: storey.openings.filter((o) => ids.has(o.wallId)) };
      const tops = renderWallTops(groupStorey, model.components);
      return planGeometry(
        diff ? recolourPlan(tops, diff.status) : tops,
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
    const diff = ctx.shownDiff();
    if (!diff) return [];
    const { status, base } = diff;
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

  function build(model: BuildingModel, resolved: readonly ResolvedConstraint[]) {
    for (const storey of model.storeys) {
      const [labelGroup, layerGroup, constraintGroup] = buildStoreyLayers(storey, model, resolved);
      labels.add(labelGroup);
      planLayers.add(layerGroup);
      constraints.add(constraintGroup);
      storeyLayers.set(storey.id, [labelGroup, layerGroup, constraintGroup]);
    }
    updateOrientation();
  }

  return {
    clear,
    constraints: constraintsOf,
    build,
    updateOrientation,
    storeyLayers: () => storeyLayers,
    planLayers: () => planLayers,
    constraintLineMaterial: () => constraintLineMaterial,
    labelsVisible: () => labels.visible,
    constraintsVisible: () => constraints.visible,
    setLabelsVisible: (on) => {
      labels.visible = on;
    },
    setConstraintsVisible: (on) => {
      constraints.visible = on;
    },
    setPlanVisible: (on) => {
      planLayers.visible = on;
    },
  };
}
