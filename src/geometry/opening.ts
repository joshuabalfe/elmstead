import type { Opening, Wall } from "../schema/schema.js";
import { v, type Vec } from "./vec.js";
import { faceOffsets, wallPoint } from "./wall.js";

/**
 * An opening's shape through its wall. Square unless a window has a reveal, whose jambs splay from
 * the middle of the wall to one face. The IFC void, the plan, the checks and the constraints all
 * take the shape from here.
 */

/** How far each splayed jamb moves out along the wall at the splayed face; 0 without a reveal. */
export function revealSplay(w: Wall, o: Opening): number {
  if (o.kind !== "window" || !o.reveal) return 0;
  return (w.thickness / 2) * Math.tan((o.reveal.angle * Math.PI) / 180);
}

/** The opening's extent along the wall at one face: widened by the splay on the splayed face. */
export function openingExtent(w: Wall, o: Opening, face: "left" | "right"): [number, number] {
  const splay = o.kind === "window" && o.reveal?.face === face ? revealSplay(w, o) : 0;
  return [o.offsetAlongWall - splay, o.offsetAlongWall + o.width + splay];
}

/**
 * The opening's plan outline in wall coordinates: x along the wall from its start, y across it,
 * positive to the left. Square, it is the four corners in wallSegmentFootprint's order: the right
 * face from start to end, then the left face from end to start. Splayed, the two points where the
 * jambs reach the middle of the wall come in between, on the splayed side. `clearance` moves both
 * face lines outwards, and the splayed jambs carry on along their own lines to meet them.
 */
export function openingProfile(w: Wall, o: Opening, clearance = 0): Vec[] {
  const { left, right } = faceOffsets(w);
  const a = o.offsetAlongWall;
  const b = a + o.width;
  const r = right - clearance;
  const l = left + clearance;
  if (o.kind !== "window" || !o.reveal) return [v(a, r), v(b, r), v(b, l), v(a, l)];
  const mid = (left + right) / 2;
  const spread = (revealSplay(w, o) * (l - mid)) / (left - mid); // the same splay, carried on to the moved face
  return o.reveal.face === "left"
    ? [v(a, r), v(b, r), v(b, mid), v(b + spread, l), v(a - spread, l), v(a, mid)]
    : [v(a - spread, r), v(b + spread, r), v(b, mid), v(b, l), v(a, l), v(a, mid)];
}

/** The opening's plan outline in plan coordinates. */
export const openingOutline = (w: Wall, o: Opening, clearance = 0): Vec[] => openingProfile(w, o, clearance).map((p) => wallPoint(w, p.x, p.y));
