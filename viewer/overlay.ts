/**
 * The plan's overlay drawings (src/render/plan.ts `Overlay`) as scene geometry instead of raster
 * images: fills as flat unlit meshes, strokes and dashes as lines as wide and as long as on the plan
 * (1 px = 10 mm), and text as small flat haloed planes. Primitives keep the drawing's painter order:
 * consecutive primitives that draw alike are merged into one run, and each run draws after the one
 * before it.
 */
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { Bounds } from "../src/geometry/polygon.js";
import type { Vec } from "../src/geometry/vec.js";
import { PX_PER_MM } from "../src/render/style.js";
import type { Attrs, Node } from "../src/render/svg.js";
import { labelTexture } from "./text.js";

/** Metres per plan-SVG px. */
export const M_PER_PX = 1 / PX_PER_MM / 1000;

/** A plan-SVG point (px, y down from the drawing's top-left corner) in scene x and z (m; plan north is −z). */
export function toScene(p: Vec, bounds: Bounds): { x: number; z: number } {
  return { x: (bounds.minX + p.x / PX_PER_MM) / 1000, z: -(bounds.maxY - p.y / PX_PER_MM) / 1000 };
}

/** A stroke's dash and gap in metres, from its `stroke-dasharray` in px; null when it is solid. */
export function dashOf(attrs: Attrs): { dash: number; gap: number } | null {
  const raw = attrs["stroke-dasharray"];
  if (raw === undefined || raw === "none") return null;
  const [dash, gap = dash] = String(raw)
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return dash ? { dash: dash * M_PER_PX, gap: gap! * M_PER_PX } : null;
}

/** One straight piece of stroke, in plan-SVG px. */
type Segment = [Vec, Vec];

/** What a run draws: fills share a colour; strokes share a colour, width and dash; texts are drawn one by one. */
export type Run =
  | { kind: "fill"; colour: string; polygons: Vec[][] }
  | { kind: "stroke"; colour: string; width: number; dash: { dash: number; gap: number } | null; segments: Segment[] }
  | { kind: "text"; texts: { at: Vec; text: string; attrs: Attrs }[] };

const isNone = (paint: string | number | undefined) => paint === undefined || paint === "none";

/**
 * The primitives in drawing order, grouped into runs: a run continues while each primitive draws
 * like the one before it, so the runs reproduce the SVG's painter order. A polygon's fill draws
 * before its stroke, as in SVG. Fills default to black and strokes to none, as in SVG.
 */
export function toRuns(nodes: readonly Node[]): Run[] {
  const runs: Run[] = [];
  const fill = (colour: string, polygon: Vec[]) => {
    const last = runs.at(-1);
    if (last?.kind === "fill" && last.colour === colour) last.polygons.push(polygon);
    else runs.push({ kind: "fill", colour, polygons: [polygon] });
  };
  const stroke = (attrs: Attrs, segments: Segment[]) => {
    if (isNone(attrs.stroke) || !segments.length) return;
    const colour = String(attrs.stroke);
    const width = Number(attrs["stroke-width"] ?? 1) * M_PER_PX;
    const dash = dashOf(attrs);
    const last = runs.at(-1);
    const same =
      last?.kind === "stroke" &&
      last.colour === colour &&
      last.width === width &&
      last.dash?.dash === dash?.dash &&
      last.dash?.gap === dash?.gap;
    if (same) last.segments.push(...segments);
    else runs.push({ kind: "stroke", colour, width, dash, segments });
  };
  const chain = (pts: readonly Vec[], closed: boolean): Segment[] => {
    const out: Segment[] = pts.slice(1).map((p, i) => [pts[i]!, p]);
    if (closed && pts.length > 2) out.push([pts.at(-1)!, pts[0]!]);
    return out;
  };
  const walk = (node: Node) => {
    switch (node.tag) {
      case "g":
        node.children.forEach(walk);
        return;
      case "polygon":
        if (!isNone(node.attrs.fill ?? "#000")) fill(String(node.attrs.fill ?? "#000"), [...node.points]);
        stroke(node.attrs, chain(node.points, true));
        return;
      case "polyline":
        stroke(node.attrs, chain(node.points, false));
        return;
      case "line":
        stroke(node.attrs, [[node.from, node.to]]);
        return;
      case "text": {
        const last = runs.at(-1);
        const text = { at: node.at, text: node.text, attrs: node.attrs };
        if (last?.kind === "text") last.texts.push(text);
        else runs.push({ kind: "text", texts: [text] });
        return;
      }
      default:
        throw new Error(`overlay drawings have no <${node.tag}>`);
    }
  };
  nodes.forEach(walk);
  return runs;
}

/** The clockwise screen rotation (degrees) and its centre from a `rotate(a [cx cy])` transform. */
export function rotationOf(attrs: Attrs, at: Vec): { deg: number; centre: Vec } {
  const m = /rotate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+))?\s*\)/.exec(String(attrs.transform ?? ""));
  if (!m) return { deg: 0, centre: at };
  return { deg: Number(m[1]), centre: m[2] === undefined ? { x: 0, y: 0 } : { x: Number(m[2]), y: Number(m[3]) } };
}

/**
 * Where a text label's plane goes and how it turns. `offset` is the plane centre's position from the
 * text's anchor in the text's own frame (px, y down): across for `text-anchor`, down for the
 * baseline. Returns the centre in plan-SVG px and the yaw (radians, counter-clockwise from above)
 * that turns the plane by the SVG's clockwise `rotate()`.
 */
export function placeText(at: Vec, attrs: Attrs, offset: Vec): { centre: Vec; yaw: number } {
  const { deg, centre: pivot } = rotationOf(attrs, at);
  const a = (deg * Math.PI) / 180;
  const turn = (p: Vec): Vec => ({
    x: p.x * Math.cos(a) - p.y * Math.sin(a),
    y: p.x * Math.sin(a) + p.y * Math.cos(a),
  });
  const anchor = {
    x: pivot.x + turn({ x: at.x - pivot.x, y: at.y - pivot.y }).x,
    y: pivot.y + turn({ x: at.x - pivot.x, y: at.y - pivot.y }).y,
  };
  const d = turn(offset);
  // SVG turns clockwise on screen with y down; seen from above, the scene's yaw about +Y is counter-clockwise.
  return { centre: { x: anchor.x + d.x, y: anchor.y + d.y }, yaw: -a };
}

/** How an overlay sits among the scene's other layers. */
export type OverlayLayer =
  /** A storey's floor: opaque and writing depth, so it hides the storeys below. */
  | { kind: "floor"; renderOrder: number }
  /** Drawn over the model without writing depth, like the wall tops and the dimensions. */
  | { kind: "overlay"; renderOrder: number };

/** Lays a flat plane's +Y along plan north (scene −Z). */
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const UP = new THREE.Vector3(0, 1, 0);

/**
 * An overlay's primitives as a group of meshes and lines at scene height `y` (m). Each run takes
 * the next step of render order within half a unit above `layer.renderOrder`. A floor's runs also
 * step their polygon offset towards the camera, so coplanar runs keep their order without z-fighting.
 */
export function overlayGroup(
  nodes: readonly Node[],
  bounds: Bounds,
  y: number,
  layer: OverlayLayer,
  anisotropy = 1,
): THREE.Group {
  const group = new THREE.Group();
  const runs = toRuns(nodes);
  const floor = layer.kind === "floor";
  runs.forEach((run, i) => {
    const order = layer.renderOrder + (0.5 * i) / runs.length;
    const depth = {
      transparent: !floor,
      depthWrite: floor,
      ...(floor ? { polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -i } : {}),
    };
    const point = (p: Vec) => {
      const s = toScene(p, bounds);
      return [s.x, y, s.z];
    };
    if (run.kind === "fill") {
      const positions: number[] = [];
      for (const polygon of run.polygons) {
        const contour = polygon.map((p) => new THREE.Vector2(p.x, p.y));
        for (const tri of THREE.ShapeUtils.triangulateShape(contour, []))
          for (const k of tri) positions.push(...point(polygon[k]!));
      }
      const geometry = new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: run.colour, side: THREE.DoubleSide, ...depth }),
      );
      mesh.renderOrder = order;
      group.add(mesh);
    } else if (run.kind === "stroke") {
      const geometry = new LineSegmentsGeometry().setPositions(
        run.segments.flatMap(([a, b]) => [...point(a), ...point(b)]),
      );
      const material = new LineMaterial({ color: run.colour, linewidth: run.width, worldUnits: true, ...depth });
      if (run.dash) Object.assign(material, { dashed: true, dashSize: run.dash.dash, gapSize: run.dash.gap });
      const lines = new LineSegments2(geometry, material);
      if (run.dash) lines.computeLineDistances();
      lines.frustumCulled = false; // a flat line's bounding sphere can miss the camera
      lines.renderOrder = order;
      group.add(lines);
    } else {
      for (const t of run.texts) {
        const size = Number(t.attrs["font-size"] ?? 16);
        const halo = isNone(t.attrs.stroke) ? 0 : Number(t.attrs["stroke-width"] ?? 1);
        const { map, width, height, centreDy } = labelTexture(
          [{ text: t.text, size, bold: t.attrs["font-weight"] === "bold", dy: 0 }],
          String(t.attrs.fill ?? "#000"),
          halo,
        );
        map.anisotropy = anisotropy;
        const across =
          t.attrs["text-anchor"] === "middle" ? 0 : t.attrs["text-anchor"] === "end" ? -width / 2 : width / 2;
        const { centre, yaw } = placeText(t.at, t.attrs, { x: across, y: centreDy });
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(width * M_PER_PX, height * M_PER_PX),
          new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
        );
        const c = toScene(centre, bounds);
        mesh.position.set(c.x, y, c.z);
        mesh.quaternion.setFromAxisAngle(UP, yaw).multiply(FLAT);
        mesh.renderOrder = order;
        group.add(mesh);
      }
    }
  });
  return group;
}
