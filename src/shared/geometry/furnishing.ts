/**
 * Derived furnishing geometry. The model stores a kind, a position, a rotation and optional size
 * overrides; every shape here follows from them, so the IFC body, the round-trip volumes, the plan
 * symbol and the wall check cannot disagree.
 *
 * A furnishing is a few axis-aligned boxes ("parts") in a local frame: the origin is the centre of
 * the footprint on the floor, local x runs along the width (to plan +x at rotation 0), local y along
 * the depth with the front at -y and the back at +y, and z is up from the base. Parts never overlap
 * and together touch every face of the overall width × depth × height, so the IFC mesh volume is the
 * sum of the part volumes. Every thickness is `min(fixed, fraction of its dimension)`, so any
 * positive size gives valid parts.
 *
 * Lengths are plain float millimetres, like the rest of src/shared/geometry/.
 */
import type { Furnishing, FurnishingKind } from "../schema/schema.js";
import { toVec, v, type Vec } from "./vec.js";

export interface FurnishingSize {
  width: number;
  depth: number;
  height: number;
}

/** One box of a furnishing, in its local frame; `x` and `y` are the minimum corner from the footprint centre. */
export interface FurnishingPart {
  /** What the part is (`seat`, `leg`, `rim`, ...), for tests and readers; not stored in any file. */
  role: string;
  x: number;
  y: number;
  /** Height of the part's bottom above the furnishing's base. */
  z: number;
  width: number;
  depth: number;
  height: number;
}

/** Typical household sizes chosen for this repo, not measurements of any building. */
export const FURNISHING_DEFAULT_SIZE: Record<FurnishingKind, FurnishingSize> = {
  bed: { width: 1400, depth: 2000, height: 900 },
  chair: { width: 450, depth: 450, height: 900 },
  desk: { width: 1400, depth: 700, height: 750 },
  "file-cabinet": { width: 450, depth: 600, height: 1300 },
  shelf: { width: 800, depth: 300, height: 1800 },
  sofa: { width: 2000, depth: 900, height: 850 },
  table: { width: 1500, depth: 800, height: 750 },
  bath: { width: 1700, depth: 700, height: 550 },
  shower: { width: 900, depth: 900, height: 150 },
  sink: { width: 1200, depth: 600, height: 900 },
  toilet: { width: 400, depth: 700, height: 800 },
  "wash-basin": { width: 550, depth: 450, height: 850 },
};

/** The IFC class and predefined type each kind is written as. */
export const FURNISHING_IFC: Record<FurnishingKind, { class: "furniture" | "sanitary"; predefined: string }> = {
  bed: { class: "furniture", predefined: "BED" },
  chair: { class: "furniture", predefined: "CHAIR" },
  desk: { class: "furniture", predefined: "DESK" },
  "file-cabinet": { class: "furniture", predefined: "FILECABINET" },
  shelf: { class: "furniture", predefined: "SHELF" },
  sofa: { class: "furniture", predefined: "SOFA" },
  table: { class: "furniture", predefined: "TABLE" },
  bath: { class: "sanitary", predefined: "BATH" },
  shower: { class: "sanitary", predefined: "SHOWER" },
  sink: { class: "sanitary", predefined: "SINK" },
  toilet: { class: "sanitary", predefined: "TOILETPAN" },
  "wash-basin": { class: "sanitary", predefined: "WASHHANDBASIN" },
};

/** A thickness: `fixed` mm, but never more than `fraction` of the dimension it divides. */
const thick = (fixed: number, dimension: number, fraction: number): number => Math.min(fixed, dimension * fraction);

/** Builds parts from corner coordinates in [0, width] × [0, depth], then centres them on the footprint. */
function partsFrom(size: FurnishingSize, build: (box: Box) => void): FurnishingPart[] {
  const parts: FurnishingPart[] = [];
  const box: Box = (role, x0, y0, z0, x1, y1, z1) => {
    parts.push({
      role,
      x: x0 - size.width / 2,
      y: y0 - size.depth / 2,
      z: z0,
      width: x1 - x0,
      depth: y1 - y0,
      height: z1 - z0,
    });
  };
  build(box);
  return parts;
}

/** A box from (x0, y0, z0) to (x1, y1, z1). */
type Box = (role: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => void;

/** A raised rim of four strips round a recess, from `z0` to `z1`; the front and back strips run the full width. */
function rim(box: Box, role: string, w: number, d: number, t: number, z0: number, z1: number): void {
  box(role, 0, 0, z0, w, t, z1);
  box(role, 0, d - t, z0, w, d, z1);
  box(role, 0, t, z0, t, d - t, z1);
  box(role, w - t, t, z0, w, d - t, z1);
}

const SHAPES: Record<FurnishingKind, (size: FurnishingSize, box: Box) => void> = {
  bed({ width: w, depth: d, height: h }, box) {
    const head = thick(80, d, 0.04);
    const frame = thick(300, h, 0.35);
    const mattress = Math.min(frame + 250, h * 0.6);
    const inset = thick(40, w, 0.04);
    box("frame", 0, 0, 0, w, d - head, frame);
    box("mattress", inset, inset, frame, w - inset, d - head, mattress);
    box("headboard", 0, d - head, 0, w, d, h);
  },
  chair({ width: w, depth: d, height: h }, box) {
    const back = thick(40, d, 0.1);
    const leg = Math.min(thick(40, w, 0.1), back);
    const seatBase = h * 0.5;
    const seat = seatBase + thick(50, h, 0.06);
    for (const [x0, y0] of [
      [0, 0],
      [w - leg, 0],
      [0, d - leg],
      [w - leg, d - leg],
    ] as const)
      box("leg", x0, y0, 0, x0 + leg, y0 + leg, seatBase);
    box("seat", 0, 0, seatBase, w, d - back, seat);
    box("back", 0, d - back, seatBase, w, d, h);
  },
  desk({ width: w, depth: d, height: h }, box) {
    const top = thick(30, h, 0.05);
    const side = thick(40, w, 0.05);
    box("side", 0, 0, 0, side, d, h - top);
    box("side", w - side, 0, 0, w, d, h - top);
    box("top", 0, 0, h - top, w, d, h);
  },
  "file-cabinet"({ width: w, depth: d, height: h }, box) {
    box("body", 0, 0, 0, w, d, h);
  },
  shelf({ width: w, depth: d, height: h }, box) {
    const side = thick(25, w, 0.03);
    const board = thick(25, h, 0.02);
    box("side", 0, 0, 0, side, d, h);
    box("side", w - side, 0, 0, w, d, h);
    box("bottom", side, 0, 0, w - side, d, board);
    box("top", side, 0, h - board, w - side, d, h);
    for (const k of [1, 2, 3]) {
      const mid = board + (k * (h - 2 * board)) / 4;
      box("shelf", side, 0, mid - board / 2, w - side, d, mid + board / 2);
    }
  },
  sofa({ width: w, depth: d, height: h }, box) {
    const arm = thick(150, w, 0.1);
    const back = thick(200, d, 0.2);
    box("arm", 0, 0, 0, arm, d, h * 0.65);
    box("arm", w - arm, 0, 0, w, d, h * 0.65);
    box("seat", arm, 0, 0, w - arm, d - back, h * 0.5);
    box("back", arm, d - back, 0, w - arm, d, h);
  },
  table({ width: w, depth: d, height: h }, box) {
    const top = thick(30, h, 0.05);
    const leg = Math.min(thick(60, w, 0.06), thick(60, d, 0.06));
    for (const [x0, y0] of [
      [0, 0],
      [w - leg, 0],
      [0, d - leg],
      [w - leg, d - leg],
    ] as const)
      box("leg", x0, y0, 0, x0 + leg, y0 + leg, h - top);
    box("top", 0, 0, h - top, w, d, h);
  },
  bath({ width: w, depth: d, height: h }, box) {
    const floor = thick(150, h, 0.3);
    box("base", 0, 0, 0, w, d, floor);
    rim(box, "rim", w, d, Math.min(thick(60, w, 0.1), thick(60, d, 0.1)), floor, h);
  },
  shower({ width: w, depth: d, height: h }, box) {
    const floor = thick(50, h, 0.5);
    box("base", 0, 0, 0, w, d, floor);
    rim(box, "rim", w, d, Math.min(thick(40, w, 0.1), thick(40, d, 0.1)), floor, h);
  },
  sink({ width: w, depth: d, height: h }, box) {
    const cabinet = h * 0.9;
    box("cabinet", 0, 0, 0, w, d, cabinet);
    rim(box, "rim", w, d, Math.min(thick(80, w, 0.1), thick(80, d, 0.1)), cabinet, h);
  },
  toilet({ width: w, depth: d, height: h }, box) {
    const tank = thick(250, d, 0.3);
    const side = w * 0.1;
    box("pan", side, 0, 0, w - side, d - tank, h * 0.5);
    box("cistern", 0, d - tank, 0, w, d, h);
  },
  "wash-basin"({ width: w, depth: d, height: h }, box) {
    const column = h * 0.55;
    const bowl = column + thick(60, h, 0.07);
    box("pedestal", w * 0.35, d * 0.3, 0, w * 0.65, d * 0.7, column);
    box("bowl", 0, 0, column, w, d, bowl);
    rim(box, "rim", w, d, Math.min(thick(50, w, 0.1), thick(50, d, 0.1)), bowl, h);
  },
};

/** The furnishing's overall size: its overrides over its kind's defaults. */
export function furnishingSize(f: Pick<Furnishing, "kind" | "width" | "depth" | "height">): FurnishingSize {
  const d = FURNISHING_DEFAULT_SIZE[f.kind];
  return { width: f.width ?? d.width, depth: f.depth ?? d.depth, height: f.height ?? d.height };
}

/** The parts of a kind at an overall size, in the local frame. */
export function furnishingParts(kind: FurnishingKind, size: FurnishingSize): FurnishingPart[] {
  return partsFrom(size, (box) => SHAPES[kind](size, box));
}

/** The base of the furnishing above the storey floor. */
export const furnishingBase = (f: Pick<Furnishing, "elevationOffset">): number => f.elevationOffset ?? 0;

/** The furnishing's turn, in radians, counter-clockwise from plan +x. */
export const furnishingAngle = (f: Pick<Furnishing, "rotation">): number => ((f.rotation ?? 0) * Math.PI) / 180;

/** A local-frame point turned by the furnishing's rotation and moved to `at`, in plan coordinates. */
export function furnishingPoint(f: Pick<Furnishing, "at" | "rotation">, x: number, y: number): Vec {
  const a = furnishingAngle(f);
  const [cos, sin] = [Math.cos(a), Math.sin(a)];
  const at = toVec(f.at);
  return v(at.x + x * cos - y * sin, at.y + x * sin + y * cos);
}

/** The corners of a box's footprint, counter-clockwise, in plan coordinates. */
export function partFootprint(
  f: Pick<Furnishing, "at" | "rotation">,
  p: Pick<FurnishingPart, "x" | "y" | "width" | "depth">,
): Vec[] {
  return [
    furnishingPoint(f, p.x, p.y),
    furnishingPoint(f, p.x + p.width, p.y),
    furnishingPoint(f, p.x + p.width, p.y + p.depth),
    furnishingPoint(f, p.x, p.y + p.depth),
  ];
}

/** The outline of the whole furnishing, counter-clockwise, in plan coordinates. */
export function furnishingFootprint(f: Furnishing): Vec[] {
  const { width, depth } = furnishingSize(f);
  return partFootprint(f, { x: -width / 2, y: -depth / 2, width, depth });
}

export const partVolume = (p: FurnishingPart): number => p.width * p.depth * p.height;

/** The parts whose footprint is not wholly inside the footprint of a higher part: what is seen from above. */
export function visibleParts(parts: readonly FurnishingPart[]): FurnishingPart[] {
  const top = (p: FurnishingPart) => p.z + p.height;
  const EPS = 1e-6;
  return parts.filter(
    (p) =>
      !parts.some(
        (q) =>
          top(q) > top(p) + EPS &&
          q.x <= p.x + EPS &&
          q.y <= p.y + EPS &&
          q.x + q.width >= p.x + p.width - EPS &&
          q.y + q.depth >= p.y + p.depth - EPS,
      ),
  );
}

export interface FurnishingGeometry {
  size: FurnishingSize;
  /** Height of the base above the storey floor. */
  base: number;
  parts: FurnishingPart[];
  /** The overall outline, counter-clockwise, in plan coordinates. */
  footprint: Vec[];
  /** Sum of the part volumes, mm³; the parts do not overlap, so this is the body's volume. */
  volume: number;
}

/** Everything derived from a furnishing, for the writer, the round-trip, the plan and the checks. */
export function furnishingGeometry(f: Furnishing): FurnishingGeometry {
  const size = furnishingSize(f);
  const parts = furnishingParts(f.kind, size);
  return {
    size,
    base: furnishingBase(f),
    parts,
    footprint: furnishingFootprint(f),
    volume: parts.reduce((sum, p) => sum + partVolume(p), 0),
  };
}
