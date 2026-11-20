import { faceOffsets, wallDirection, wallLength, wallPoint, wallSegmentFootprint } from "../geometry/wall.js";
import { area, bounds, centroid, spans, type Bounds } from "../geometry/polygon.js";
import { dot, perpLeft, toVec, v, vadd, vscale, vsub, type Vec } from "../geometry/vec.js";
import type { BuildingModel, Door, Opening, Storey, Wall, Window } from "../schema/schema.js";
import { C, CUT_HEIGHT, FONT, MARGIN, PX_PER_MM, ROOM_LABEL } from "./style.js";
import { el, group, line, num, polygon, polyline, text } from "./svg.js";

export interface PlanOptions {
  /** Draw element ids as small labels. */
  ids: boolean;
}

/** Plan (mm, y north) → SVG (px, y down). */
interface View {
  toPx(p: Vec): Vec;
  toMm(p: Vec): Vec;
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
  const toMm = (p: Vec) => v(extent.minX + (p.x - MARGIN.left) / PX_PER_MM, extent.maxY - (p.y - MARGIN.top) / PX_PER_MM);
  return {
    toPx,
    toMm,
    extent,
    width: Math.ceil(MARGIN.left + MARGIN.right + (extent.maxX - extent.minX) * PX_PER_MM),
    height: Math.ceil(MARGIN.top + MARGIN.bottom + (extent.maxY - extent.minY) * PX_PER_MM),
  };
}

const m2 = (a: number) => `${(a / 1e6).toFixed(1)} m²`;

/** Whether the plan's cut plane passes through the opening. */
const isCut = (o: Opening) => o.sillHeight < CUT_HEIGHT && o.sillHeight + o.height > CUT_HEIGHT;

/** Wall body minus the gaps cut by its openings, as plan polygons. */
function wallPieces(w: Wall, openings: readonly Opening[]): Vec[][] {
  const L = wallLength(w);
  const cuts = openings
    .filter((o) => o.wallId === w.id && isCut(o))
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

/** A door's opening through the wall, in the paper colour: for the 3D wall tops, which aren't cut. */
function drawDoorGap(w: Wall, d: Door, view: View): string {
  return group({ class: "door-gap", "data-id": d.id }, [
    polygon(wallSegmentFootprint(w, d.offsetAlongWall, d.offsetAlongWall + d.width).map(view.toPx), { fill: C.paper, stroke: "none" }),
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

/** Opening the cut plane misses (e.g. a fanlight): dashed outline over the uncut wall. */
function drawUncut(w: Wall, o: Opening, view: View): string {
  const outline = wallSegmentFootprint(w, o.offsetAlongWall, o.offsetAlongWall + o.width).map(view.toPx);
  return group({ class: o.kind, "data-id": o.id, "data-cut": "false" }, [
    polygon(outline, { fill: "none", stroke: o.kind === "window" ? C.glass : C.dim, "stroke-width": 1, "stroke-dasharray": "4 2" }),
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
  const extensions = offsetPx === 0 ? [] : [
    line(vadd(P, vscale(n, 4)), vadd(P2, vscale(n, 4)), { stroke: C.dim, "stroke-width": 0.5 }),
    line(vadd(Q, vscale(n, 4)), vadd(Q2, vscale(n, 4)), { stroke: C.dim, "stroke-width": 0.5 }),
  ];
  return [
    ...extensions,
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

/** Distance (mm) from a room's edge to its internal dimension lines. */
const ROOM_DIM_INSET = 150;
const ROOM_DIM_STEP = 25;
/** Clearance (px) between a room's label and its dimension lines, room for the dimension figure. */
const ROOM_DIM_CLEAR = 20;

/**
 * A room's clear size: its longest wall-to-wall span east–west and north–south, drawn as dimension
 * lines inside the room. Of the equally long spans, the one nearest the label that stays clear of it
 * is drawn; in a room too narrow for that, the one farthest from the label.
 */
function roomDimensions(id: string, pts: readonly Vec[], label: Bounds, view: View): string[] {
  const b = bounds(pts);
  // Label box in plan mm, widened by the clearance.
  const pad = ROOM_DIM_CLEAR / PX_PER_MM;
  const lo = vsub(view.toMm(v(label.minX, label.maxY)), v(pad, pad));
  const hi = vadd(view.toMm(v(label.maxX, label.minY)), v(pad, pad));
  const c = vscale(vadd(lo, hi), 0.5);

  const longest = (axis: "x" | "y") => {
    const found: { at: number; span: [number, number]; len: number }[] = [];
    for (let at = b[`min${axis.toUpperCase() as "X" | "Y"}`] + ROOM_DIM_INSET; at <= b[`max${axis.toUpperCase() as "X" | "Y"}`] - ROOM_DIM_INSET; at += ROOM_DIM_STEP) {
      for (const span of spans(pts, axis, at)) found.push({ at, span, len: Math.round(span[1] - span[0]) });
    }
    if (!found.length) return undefined;
    const max = Math.max(...found.map((f) => f.len));
    const best = found.filter((f) => f.len === max);
    const clear = best.filter((f) => f.at < lo[axis] || f.at > hi[axis]);
    const near = (f: { at: number }) => Math.abs(f.at - c[axis]);
    if (clear.length) return { ...clear.sort((a, b) => near(a) - near(b))[0]!, clear: true };
    return { ...best.sort((a, b) => near(b) - near(a))[0]!, clear: false };
  };
  const draw = (p: Vec, q: Vec, len: number, towardLabel: boolean) => {
    // The helper writes the figure to the left of p→q on screen: on the label's side when the line is
    // clear of the label, otherwise on the wall side so it doesn't overwrite the label.
    const [P, Q] = [view.toPx(p), view.toPx(q)];
    const left = v(Q.y - P.y, P.x - Q.x);
    return dot(vsub(view.toPx(c), P), left) >= 0 === towardLabel ? dimension(p, q, `${len}`, 0, view) : dimension(q, p, `${len}`, 0, view);
  };
  const out: string[] = [];
  const ew = longest("y");
  if (ew) out.push(...draw(v(ew.span[0], ew.at), v(ew.span[1], ew.at), ew.len, ew.clear));
  const ns = longest("x");
  if (ns) out.push(...draw(v(ns.at, ns.span[0]), v(ns.at, ns.span[1]), ns.len, ns.clear));
  return out.length ? [group({ class: "room-dimensions", "data-id": id }, out)] : [];
}

function northArrow(at: Vec, northAngleDeg: number): string {
  // northAngle is counter-clockwise from plan +y; SVG rotation is clockwise.
  const a = (northAngleDeg * Math.PI) / 180;
  // The "N" stays upright, just beyond the arrow's tip (5 px lower to centre it vertically).
  const n = v(at.x - 33 * Math.sin(a), at.y - 33 * Math.cos(a) + 5);
  return group({}, [
    group({ transform: `translate(${num(at.x)} ${num(at.y)}) rotate(${num(-northAngleDeg)})` }, [
      el("circle", { cx: 0, cy: 0, r: 22, fill: "none", stroke: C.ink, "stroke-width": 1 }),
      polygon([v(0, -20), v(8, 10), v(0, 4), v(-8, 10)], { fill: C.ink }),
    ]),
    text(n, "N", { "font-size": 14, "font-weight": "bold", "text-anchor": "middle", fill: C.ink }),
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

/** Overall dimensions: below and to the right of the drawing extent. */
function overallDimensions(view: View): string[] {
  const { extent } = view;
  const sw = v(extent.minX, extent.minY);
  const se = v(extent.maxX, extent.minY);
  const ne = v(extent.maxX, extent.maxY);
  return [...dimension(sw, se, `${extent.maxX - extent.minX}`, -40, view), ...dimension(se, ne, `${extent.maxY - extent.minY}`, -40, view)];
}

/** Where each room's label goes (its centroid, mm) and what it says. */
export function roomTags(storey: Storey): { id: string; name: string; area: string; at: Vec }[] {
  return storey.rooms.map((r) => {
    const pts = r.outline.map(toVec);
    return { id: r.id, name: r.name, area: m2(area(pts)), at: centroid(pts) };
  });
}

/** Each room's dimensions and, unless `names` is false, its name and area. */
function roomLabels(storey: Storey, view: View, opts: PlanOptions, names = true): string[] {
  const out: string[] = [];
  for (const r of storey.rooms) {
    const pts = r.outline.map(toVec);
    const c = view.toPx(centroid(pts));
    const { name, area: areaFont } = ROOM_LABEL;
    if (names) {
      out.push(text(v(c.x, c.y + name.dy), r.name, { "font-size": name.size, "font-weight": "bold", "text-anchor": "middle", fill: C.ink }));
      out.push(text(v(c.x, c.y + areaFont.dy), m2(area(pts)), { "font-size": areaFont.size, "text-anchor": "middle", fill: C.ink }));
    }
    // Rough label extent (px) from character counts; DejaVu Sans averages about 0.6 em per character.
    // Dimensions keep clear of it even when the label is drawn elsewhere (the 3D viewer's billboards).
    const halfW = Math.max(r.name.length * name.size * 0.62, 7 * areaFont.size * 0.6) / 2;
    out.push(...roomDimensions(r.id, pts, { minX: c.x - halfW, maxX: c.x + halfW, minY: c.y - 17, maxY: c.y + (opts.ids ? 29 : 16) }, view));
    if (opts.ids) out.push(text(v(c.x, c.y + 26), r.id, { "font-size": 8, "text-anchor": "middle", fill: C.id }));
  }
  return out;
}

/** A transparent SVG the size of the storey's plan, and the plan area (mm) it covers edge to edge. */
function overlay(storey: Storey, body: (view: View) => string[]): { svg: string; bounds: Bounds } {
  const view = makeView(storey);
  const minX = view.extent.minX - MARGIN.left / PX_PER_MM;
  const maxY = view.extent.maxY + MARGIN.top / PX_PER_MM;
  const bounds = { minX, maxY, maxX: minX + view.width / PX_PER_MM, minY: maxY - view.height / PX_PER_MM };
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}" font-family="${FONT}, sans-serif">`,
    ...body(view),
    "</svg>",
    "",
  ].join("\n");
  return { svg, bounds };
}

/**
 * The plan's dimensions (room and overall) and, unless `names` is false, its room labels alone,
 * on a transparent background, for laying in the 3D viewer, with haloed text so it reads over the
 * model.
 */
export function renderPlanAnnotations(storey: Storey, { names = true }: { names?: boolean } = {}): { svg: string; bounds: Bounds } {
  return overlay(storey, (view) => [
    // Without the paper underneath, the text needs a halo and the lines more weight to read on a floor.
    `<style>text { stroke: ${C.paper}; stroke-width: 3px; stroke-linejoin: round; paint-order: stroke; } line { stroke: ${C.ink}; stroke-width: 1px; }</style>`,
    ...roomLabels(storey, view, { ids: false }, names),
    ...overallDimensions(view),
  ]);
}

/**
 * Walls, split around the openings they cut, then door and window symbols, as the plan draws them.
 * `doors` picks what a cut door draws: its swing (the plan), its gap in the paper colour (the 3D
 * wall tops, which aren't cut), or nothing.
 */
function wallsAndOpenings(storey: Storey, view: View, doors: "swing" | "gap" = "swing"): string[] {
  const walls = storey.walls.filter((w) => wallLength(w) > 0);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const out: string[] = [];
  // Walls: filled pieces with no outline, so butt joints look continuous.
  for (const w of walls) {
    for (const piece of wallPieces(w, storey.openings)) {
      out.push(polygon(piece.map(view.toPx), { class: "wall", "data-id": w.id, fill: C.wall, stroke: "none" }));
    }
  }
  // Uncut openings last, so a fanlight's dashed outline lies over the gap of the door below it.
  for (const o of [...storey.openings].sort((a, b) => Number(!isCut(a)) - Number(!isCut(b)))) {
    const w = wallById.get(o.wallId);
    if (!w) continue; // reported by checks
    if (!isCut(o)) out.push(drawUncut(w, o, view));
    else if (o.kind === "window") out.push(drawWindow(w, o, view));
    else out.push(doors === "swing" ? drawDoor(w, o, view) : drawDoorGap(w, o, view));
  }
  return out;
}

/** Each cut door's leaf and swing, as on the plan. */
function doorSwings(storey: Storey, view: View): string[] {
  const wallById = new Map(storey.walls.map((w) => [w.id, w]));
  return storey.openings.flatMap((o) => {
    const w = wallById.get(o.wallId);
    return w && o.kind === "door" && isCut(o) && wallLength(w) > 0 ? [drawDoor(w, o, view)] : [];
  });
}

/**
 * The plan's walls, door gaps and windows alone, on a transparent background, for the 3D viewer to
 * lay over the wall tops, so looking down shows what is in the walls below as the plan does. Door
 * swings go on the floor instead (renderFloor).
 */
export function renderWallTops(storey: Storey): { svg: string; bounds: Bounds } {
  return overlay(storey, (view) => wallsAndOpenings(storey, view, "gap"));
}

/** The plan's room fills and door swings alone, on a transparent background, for the 3D viewer's floor. */
export function renderFloor(storey: Storey): { svg: string; bounds: Bounds } {
  return overlay(storey, (view) => [
    ...storey.rooms.map((r) => polygon(r.outline.map((p) => view.toPx(toVec(p))), { fill: C.room, stroke: "none" })),
    ...doorSwings(storey, view),
  ]);
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

  out.push(...wallsAndOpenings(storey, view));

  out.push(...roomLabels(storey, view, opts));

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

  out.push(...overallDimensions(view));

  const title = `${model.building.name} — ${storey.name} plan`;
  const sub = `Elevation ${storey.elevation} mm · dimensions in mm · 1 px = ${num(1 / PX_PER_MM)} mm`;
  out.push(text(v(MARGIN.left, 28), title, { "font-size": 18, "font-weight": "bold", fill: C.ink }));
  out.push(text(v(MARGIN.left, 46), sub, { "font-size": 11, fill: C.dim }));
  // Top right, clear of the overall dimension line below it whichever way the "N" falls.
  out.push(northArrow(v(view.width - 35, 40), model.site.northAngle ?? 0));
  out.push(scaleBar(v(MARGIN.left, view.height - 40)));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}" font-family="${FONT}">`,
    el("rect", { x: 0, y: 0, width: view.width, height: view.height, fill: C.paper }),
    ...out,
    "</svg>",
    "",
  ].join("\n");
}
