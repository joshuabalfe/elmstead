import { faceOffsets, wallDirection, wallLength, wallPoint, wallSegmentFootprint } from "../geometry/wall.js";
import { area, bounds, centroid, type Bounds } from "../geometry/polygon.js";
import { perpLeft, toVec, v, vadd, vscale, vsub, type Vec } from "../geometry/vec.js";
import type { BuildingModel, Door, Opening, Storey, Wall, Window } from "../schema/schema.js";
import { C, FONT, MARGIN, PX_PER_MM } from "./style.js";
import { el, group, line, num, polygon, polyline, text } from "./svg.js";

export interface PlanOptions {
  /** Draw element ids as small labels. */
  ids: boolean;
}

/** Plan (mm, y north) → SVG (px, y down). */
interface View {
  toPx(p: Vec): Vec;
  /** mm extent of the drawing, before margins */
  extent: Bounds;
  width: number;
  height: number;
}

function makeView(storey: Storey): View {
  const pts: Vec[] = [
    ...storey.walls.flatMap((w) => (wallLength(w) > 0 ? wallSegmentFootprint(w, 0, wallLength(w)) : [toVec(w.start)])),
    ...storey.slabs.flatMap((s) => s.outline.map(toVec)),
    ...storey.rooms.flatMap((r) => r.outline.map(toVec)),
  ];
  const extent = pts.length ? bounds(pts) : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const toPx = (p: Vec) => v(MARGIN.left + (p.x - extent.minX) * PX_PER_MM, MARGIN.top + (extent.maxY - p.y) * PX_PER_MM);
  return {
    toPx,
    extent,
    width: Math.ceil(MARGIN.left + MARGIN.right + (extent.maxX - extent.minX) * PX_PER_MM),
    height: Math.ceil(MARGIN.top + MARGIN.bottom + (extent.maxY - extent.minY) * PX_PER_MM),
  };
}

const m2 = (a: number) => `${(a / 1e6).toFixed(1)} m²`;
const metres = (mm: number) => `${(mm / 1000).toFixed(2)}`;

/** Wall body minus the gaps cut by its openings, as plan polygons. */
function wallPieces(w: Wall, openings: readonly Opening[]): Vec[][] {
  const L = wallLength(w);
  const cuts = openings
    .filter((o) => o.wallId === w.id)
    .map((o) => [Math.max(0, o.offsetAlongWall), Math.min(L, o.offsetAlongWall + o.width)] as const)
    .sort((a, b) => a[0] - b[0]);
  const pieces: Vec[][] = [];
  let at = 0;
  for (const [from, to] of cuts) {
    if (from > at) pieces.push(wallSegmentFootprint(w, at, from));
    at = Math.max(at, to);
  }
  if (at < L) pieces.push(wallSegmentFootprint(w, at, L));
  return pieces;
}

/** Door symbol geometry in plan mm: hinge on the face the door opens towards, leaf drawn fully open (90°). */
export function doorGeometry(w: Wall, d: Door): { hinge: Vec; open: Vec; closed: Vec } {
  const swing = d.swing ?? { hinge: "start", side: "left" };
  const { left, right } = faceOffsets(w);
  const faceAcross = swing.side === "left" ? left : right;
  const hingeAlong = swing.hinge === "start" ? d.offsetAlongWall : d.offsetAlongWall + d.width;
  const closedAlong = swing.hinge === "start" ? d.offsetAlongWall + d.width : d.offsetAlongWall;
  const hinge = wallPoint(w, hingeAlong, faceAcross);
  const outward = vscale(perpLeft(wallDirection(w)), swing.side === "left" ? 1 : -1);
  return { hinge, open: vadd(hinge, vscale(outward, d.width)), closed: wallPoint(w, closedAlong, faceAcross) };
}

function drawDoor(w: Wall, d: Door, view: View): string {
  const { hinge, open, closed } = doorGeometry(w, d);
  // Quarter arc from the open leaf tip back to the closed position, as a polyline (no sweep-flag ambiguity).
  const a0 = Math.atan2(open.y - hinge.y, open.x - hinge.x);
  const c = vsub(closed, hinge);
  let a1 = Math.atan2(c.y, c.x);
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
  const N = 24;
  const arc = Array.from({ length: N + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / N;
    return view.toPx(vadd(hinge, v(Math.cos(a) * d.width, Math.sin(a) * d.width)));
  });
  return group({ class: "door", "data-id": d.id }, [
    line(view.toPx(hinge), view.toPx(open), { stroke: C.opening, "stroke-width": 1.6 }),
    polyline(arc, { stroke: C.opening, "stroke-width": 0.7, "stroke-dasharray": "3 2" }),
  ]);
}

function drawWindow(w: Wall, win: Window, view: View): string {
  const { left, right } = faceOffsets(w);
  const a = win.offsetAlongWall;
  const b = a + win.width;
  const frame = wallSegmentFootprint(w, a, b).map(view.toPx);
  const mid = (left + right) / 2;
  const glassGap = Math.min(25, (left - right) / 6);
  return group({ class: "window", "data-id": win.id }, [
    polygon(frame, { fill: C.paper, stroke: C.opening, "stroke-width": 0.8 }),
    line(view.toPx(wallPoint(w, a, mid + glassGap)), view.toPx(wallPoint(w, b, mid + glassGap)), { stroke: C.glass, "stroke-width": 1 }),
    line(view.toPx(wallPoint(w, a, mid - glassGap)), view.toPx(wallPoint(w, b, mid - glassGap)), { stroke: C.glass, "stroke-width": 1 }),
  ]);
}

/** Linear dimension between two plan points, offset perpendicular by `offsetPx` (positive = left of p→q). */
function dimension(p: Vec, q: Vec, label: string, offsetPx: number, view: View): string[] {
  const P = view.toPx(p);
  const Q = view.toPx(q);
  const d = vsub(Q, P);
  const L = Math.hypot(d.x, d.y);
  if (L === 0) return [];
  const u = vscale(d, 1 / L);
  // SVG y is down, so the left normal on screen is (y, -x).
  const n = v(u.y, -u.x);
  const P2 = vadd(P, vscale(n, offsetPx));
  const Q2 = vadd(Q, vscale(n, offsetPx));
  const tick = (c: Vec) => line(vadd(c, vscale(vadd(u, n), -4)), vadd(c, vscale(vadd(u, n), 4)), { stroke: C.dim, "stroke-width": 1 });
  const midPt = vadd(vscale(vadd(P2, Q2), 0.5), vscale(n, 6));
  const angle = (Math.atan2(u.y, u.x) * 180) / Math.PI;
  const upright = angle >= 90 || angle < -90 ? angle + 180 : angle;
  return [
    line(vadd(P, vscale(n, 4)), vadd(P2, vscale(n, 4)), { stroke: C.dim, "stroke-width": 0.5 }),
    line(vadd(Q, vscale(n, 4)), vadd(Q2, vscale(n, 4)), { stroke: C.dim, "stroke-width": 0.5 }),
    line(P2, Q2, { stroke: C.dim, "stroke-width": 0.8 }),
    tick(P2),
    tick(Q2),
    text(midPt, label, {
      "font-size": 11,
      fill: C.dim,
      "text-anchor": "middle",
      transform: `rotate(${num(upright)} ${num(midPt.x)} ${num(midPt.y)})`,
    }),
  ];
}

function northArrow(at: Vec, northAngleDeg: number): string {
  // northAngle is counter-clockwise from plan +y; SVG rotation is clockwise.
  return group({ transform: `translate(${num(at.x)} ${num(at.y)}) rotate(${num(-northAngleDeg)})` }, [
    el("circle", { cx: 0, cy: 0, r: 22, fill: "none", stroke: C.ink, "stroke-width": 1 }),
    polygon([v(0, -20), v(8, 10), v(0, 4), v(-8, 10)], { fill: C.ink }),
    text(v(0, -28), "N", { "font-size": 14, "font-weight": "bold", "text-anchor": "middle", fill: C.ink }),
  ]);
}

function scaleBar(at: Vec): string {
  const segMm = 1000;
  const n = 5;
  const segPx = segMm * PX_PER_MM;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(el("rect", { x: at.x + i * segPx, y: at.y, width: segPx, height: 6, fill: i % 2 ? C.paper : C.ink, stroke: C.ink, "stroke-width": 0.8 }));
    parts.push(text(v(at.x + i * segPx, at.y + 20), `${i}`, { "font-size": 10, "text-anchor": "middle", fill: C.ink }));
  }
  parts.push(text(v(at.x + n * segPx, at.y + 20), `${n} m`, { "font-size": 10, "text-anchor": "middle", fill: C.ink }));
  return group({}, parts);
}

export function renderPlan(model: BuildingModel, storey: Storey, opts: PlanOptions): string {
  const view = makeView(storey);
  const { extent } = view;
  const walls = [...storey.walls].filter((w) => wallLength(w) > 0);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const out: string[] = [];

  // Slabs: dashed outline only, beneath everything.
  for (const s of storey.slabs) {
    out.push(polygon(s.outline.map((p) => view.toPx(toVec(p))), { class: "slab", "data-id": s.id, fill: "none", stroke: C.slab, "stroke-width": 0.8, "stroke-dasharray": "6 3" }));
  }

  // Rooms: tinted fill; labels are drawn later so walls never cover them.
  for (const r of storey.rooms) {
    out.push(polygon(r.outline.map((p) => view.toPx(toVec(p))), { class: "room", "data-id": r.id, fill: C.room, stroke: "none" }));
  }

  // Walls: filled pieces with no outline, so butt joints look continuous.
  for (const w of walls) {
    for (const piece of wallPieces(w, storey.openings)) {
      out.push(polygon(piece.map(view.toPx), { class: "wall", "data-id": w.id, fill: C.wall, stroke: "none" }));
    }
  }

  for (const o of storey.openings) {
    const w = wallById.get(o.wallId);
    if (!w) continue; // reported by checks
    out.push(o.kind === "door" ? drawDoor(w, o, view) : drawWindow(w, o, view));
  }

  for (const r of storey.rooms) {
    const pts = r.outline.map(toVec);
    const c = view.toPx(centroid(pts));
    const b = bounds(pts);
    out.push(text(v(c.x, c.y - 4), r.name, { "font-size": 13, "font-weight": "bold", "text-anchor": "middle", fill: C.ink }));
    out.push(text(v(c.x, c.y + 12), m2(area(pts)), { "font-size": 11, "text-anchor": "middle", fill: C.ink }));
    out.push(text(v(c.x, c.y + 26), `${metres(b.maxX - b.minX)} × ${metres(b.maxY - b.minY)}`, { "font-size": 9, "text-anchor": "middle", fill: C.dim }));
    if (opts.ids) out.push(text(v(c.x, c.y + 39), r.id, { "font-size": 8, "text-anchor": "middle", fill: C.id }));
  }

  if (opts.ids) {
    for (const w of walls) {
      const p = view.toPx(wallPoint(w, wallLength(w) * 0.25, (faceOffsets(w).left + faceOffsets(w).right) / 2));
      out.push(text(v(p.x, p.y + 3), w.id, { "font-size": 8, "text-anchor": "middle", fill: C.id, stroke: C.paper, "stroke-width": 2.5, "stroke-linejoin": "round", "paint-order": "stroke" }));
    }
    for (const o of storey.openings) {
      const w = wallById.get(o.wallId);
      if (!w) continue;
      const { left, right } = faceOffsets(w);
      const p = view.toPx(wallPoint(w, o.offsetAlongWall + o.width / 2, (left + right) / 2));
      out.push(text(v(p.x, p.y + 3), o.id, { "font-size": 8, "text-anchor": "middle", fill: C.id, stroke: C.paper, "stroke-width": 2.5, "stroke-linejoin": "round", "paint-order": "stroke" }));
    }
  }

  // Overall dimensions: below and to the right of the drawing extent.
  const sw = v(extent.minX, extent.minY);
  const se = v(extent.maxX, extent.minY);
  const ne = v(extent.maxX, extent.maxY);
  out.push(...dimension(sw, se, `${extent.maxX - extent.minX}`, -40, view));
  out.push(...dimension(se, ne, `${extent.maxY - extent.minY}`, -40, view));

  const title = `${model.building.name} — ${storey.name} plan`;
  const sub = `Elevation ${storey.elevation} mm · dimensions in mm · 1 px = ${num(1 / PX_PER_MM)} mm`;
  out.push(text(v(MARGIN.left, 28), title, { "font-size": 18, "font-weight": "bold", fill: C.ink }));
  out.push(text(v(MARGIN.left, 46), sub, { "font-size": 11, fill: C.dim }));
  out.push(northArrow(v(view.width - 45, 60), model.site.northAngle ?? 0));
  out.push(scaleBar(v(MARGIN.left, view.height - 40)));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}" font-family="${FONT}">`,
    el("rect", { x: 0, y: 0, width: view.width, height: view.height, fill: C.paper }),
    ...out,
    "</svg>",
    "",
  ].join("\n");
}
