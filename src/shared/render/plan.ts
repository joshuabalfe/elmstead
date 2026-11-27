import { faceOffsets, wallDirection, wallLength, wallPoint, wallSegmentFootprint } from "../geometry/wall.js";
import { jambEdges, openingOutline, openingProfile } from "../geometry/opening.js";
import { area, bounds, centroid, spans, type Bounds } from "../geometry/polygon.js";
import { POST_SIZE, railingPostPoints } from "../geometry/railing.js";
import { flightFootprint, flightTreads, stairLevels, winderFan } from "../geometry/stair.js";
import { GLAZING_BAR_DEPTH, windowDivision } from "../geometry/window.js";
import { dot, perpLeft, toVec, unit, v, vadd, vscale, vsub, type Vec } from "../geometry/vec.js";
import type {
  BuildingModel,
  Components,
  Door,
  Opening,
  Stair,
  StairFlight,
  Storey,
  Wall,
  Window,
  WindowComponent,
} from "../schema/schema.js";
import { C, CUT_HEIGHT, FONT, MARGIN, PX_PER_MM, ROOM_LABEL } from "./style.js";
import { el, group, line, num, polygon, polyline, serialise, text, type Attrs, type Node } from "./svg.js";

export interface PlanOptions {
  /** Draw element ids as small labels. */
  ids: boolean;
  /**
   * `north` (the default) turns the sheet by the site's northAngle so true north points up, as on a
   * site location plan; `project` keeps plan +y up, for comparisons that align on pixel rows.
   */
  orientation?: "north" | "project";
}

/** Plan (mm, y north) → SVG (px, y down), turned clockwise by `turn` degrees. */
interface View {
  toPx(p: Vec): Vec;
  toMm(p: Vec): Vec;
  /** mm extent of the drawing along plan x and y, before margins */
  extent: Bounds;
  /** Degrees the sheet is turned clockwise from plan +y up. */
  turn: number;
  width: number;
  height: number;
}

function makeView(storey: Storey, { railings = false, turn = 0 }: { railings?: boolean; turn?: number } = {}): View {
  const pts: Vec[] = [
    ...storey.walls.flatMap((w) => (wallLength(w) > 0 ? wallSegmentFootprint(w, 0, wallLength(w)) : [toVec(w.start)])),
    ...storey.slabs.flatMap((s) => s.outline.map(toVec)),
    ...storey.rooms.flatMap((r) => r.outline.map(toVec)),
    ...stairPoints(storey),
    // Only the plan sheet includes railings; the viewer's overlay keeps the extent it had.
    ...(railings ? (storey.railings ?? []).flatMap((r) => [toVec(r.start), toVec(r.end)]) : []),
  ];
  const extent = pts.length ? bounds(pts) : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  // Turn plan mm clockwise about the origin, so a north angle of `turn` points up the sheet.
  const a = (turn * Math.PI) / 180;
  const [cos, sin] = [Math.cos(a), Math.sin(a)];
  const rot = (p: Vec) => (turn === 0 ? p : v(p.x * cos + p.y * sin, p.y * cos - p.x * sin));
  const unrot = (p: Vec) => (turn === 0 ? p : v(p.x * cos - p.y * sin, p.x * sin + p.y * cos));
  // The sheet holds the turned drawing and the corners of its plan extent, where the overall dimensions run.
  const { minX, minY, maxX, maxY } = extent;
  const sheet =
    turn === 0 ? extent : bounds([...pts, v(minX, minY), v(maxX, minY), v(maxX, maxY), v(minX, maxY)].map(rot));
  const toPx = (p: Vec) => {
    const q = rot(p);
    return v(MARGIN.left + (q.x - sheet.minX) * PX_PER_MM, MARGIN.top + (sheet.maxY - q.y) * PX_PER_MM);
  };
  const toMm = (p: Vec) =>
    unrot(v(sheet.minX + (p.x - MARGIN.left) / PX_PER_MM, sheet.maxY - (p.y - MARGIN.top) / PX_PER_MM));
  return {
    toPx,
    toMm,
    extent,
    turn,
    width: Math.ceil(MARGIN.left + MARGIN.right + (sheet.maxX - sheet.minX) * PX_PER_MM),
    height: Math.ceil(MARGIN.top + MARGIN.bottom + (sheet.maxY - sheet.minY) * PX_PER_MM),
  };
}

const m2 = (a: number) => `${(a / 1e6).toFixed(1)} m²`;

/** Whether the plan's cut plane passes through the opening. */
const isCut = (o: Opening) => o.sillHeight < CUT_HEIGHT && o.sillHeight + o.height > CUT_HEIGHT;

/**
 * Where a stretch of wall ends against an opening's jamb, in wall (along, across) coordinates from
 * the right face to the left: the jamb of the opening's own outline, kept within the wall's length.
 */
function jambEdge(w: Wall, o: Opening, jamb: "near" | "far", L: number): Vec[] {
  return jambEdges(openingProfile(w, o))[jamb].map((p) => v(Math.min(L, Math.max(0, p.x)), p.y));
}

/** Wall body minus the gaps cut by its openings, as plan polygons. */
function wallPieces(w: Wall, openings: readonly Opening[]): Vec[][] {
  const L = wallLength(w);
  const { left, right } = faceOffsets(w);
  const cuts = openings
    .filter((o) => o.wallId === w.id && isCut(o))
    .sort((a, b) => a.offsetAlongWall - b.offsetAlongWall);
  const pieces: Vec[][] = [];
  // A stretch runs from one edge to the next, each listed right face to left face, so its outline
  // is the start edge's first point, the end edge, then the rest of the start edge backwards. It is
  // drawn only if neither face runs backwards (a splay into a neighbour, reported by the checks),
  // which would twist the outline, and at least one has length.
  const piece = (start: Vec[], end: Vec[]) => {
    const right = end[0]!.x - start[0]!.x;
    const left = end.at(-1)!.x - start.at(-1)!.x;
    if (right >= 0 && left >= 0 && right + left > 0) {
      pieces.push([start[0]!, ...end, ...start.slice(1).reverse()].map((p) => wallPoint(w, p.x, p.y)));
    }
  };
  let start = [v(0, right), v(0, left)];
  let at = 0;
  for (const o of cuts) {
    if (o.offsetAlongWall >= at) piece(start, jambEdge(w, o, "near", L));
    if (o.offsetAlongWall + o.width > at) {
      start = jambEdge(w, o, "far", L);
      at = o.offsetAlongWall + o.width;
    }
  }
  piece(start, [v(L, right), v(L, left)]);
  return pieces;
}

/**
 * Door symbol geometry in plan mm: hinge on the face the door opens towards, leaf drawn fully
 * open (90°). A frame insets the hinge and the closed edge, shrinking the leaf.
 */
export function doorGeometry(w: Wall, d: Door, frameWidth = 0): { hinge: Vec; open: Vec; closed: Vec; leaf: number } {
  const swing = d.swing ?? { hinge: "start", side: "left" };
  const { left, right } = faceOffsets(w);
  const faceAcross = swing.side === "left" ? left : right;
  const leaf = d.width - 2 * frameWidth;
  const openAlong = d.offsetAlongWall + frameWidth;
  const closeAlong = d.offsetAlongWall + d.width - frameWidth;
  const hingeAlong = swing.hinge === "start" ? openAlong : closeAlong;
  const closedAlong = swing.hinge === "start" ? closeAlong : openAlong;
  const hinge = wallPoint(w, hingeAlong, faceAcross);
  const outward = vscale(perpLeft(wallDirection(w)), swing.side === "left" ? 1 : -1);
  return { hinge, open: vadd(hinge, vscale(outward, leaf)), closed: wallPoint(w, closedAlong, faceAcross), leaf };
}

function drawDoor(w: Wall, d: Door, view: View, frameWidth = 0): Node {
  const { hinge, open, closed, leaf } = doorGeometry(w, d, frameWidth);
  // Quarter arc from the open leaf tip back to the closed position, as a polyline (no sweep-flag ambiguity).
  const a0 = Math.atan2(open.y - hinge.y, open.x - hinge.x);
  const c = vsub(closed, hinge);
  let a1 = Math.atan2(c.y, c.x);
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
  const N = 24;
  const arc = Array.from({ length: N + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / N;
    return view.toPx(vadd(hinge, v(Math.cos(a) * leaf, Math.sin(a) * leaf)));
  });
  return group({ class: "door", "data-id": d.id }, [
    line(view.toPx(hinge), view.toPx(open), { stroke: C.opening, "stroke-width": 1.6 }),
    polyline(arc, { stroke: C.opening, "stroke-width": 0.7, "stroke-dasharray": "3 2" }),
  ]);
}

/** A door's opening through the wall, in the paper colour: for the 3D wall tops, which aren't cut. */
function drawDoorGap(w: Wall, d: Door, view: View): Node {
  return group({ class: "door-gap", "data-id": d.id }, [
    polygon(wallSegmentFootprint(w, d.offsetAlongWall, d.offsetAlongWall + d.width).map(view.toPx), {
      fill: C.paper,
      stroke: "none",
    }),
  ]);
}

/** Outline, two glass lines, and the frame and glazing bars wherever the cut passes through them. */
function drawWindow(w: Wall, win: Window, view: View, design?: WindowComponent): Node {
  const { left, right } = faceOffsets(w);
  const a = win.offsetAlongWall;
  const b = a + win.width;
  const frame = openingOutline(w, win).map(view.toPx);
  const mid = (left + right) / 2;
  const glassGap = Math.min(25, (left - right) / 6);
  // In the window's own elevation the cut is a horizontal line: the jambs and vertical bars cross it.
  const cutZ = CUT_HEIGHT - win.sillHeight;
  const division = windowDivision(win, design);
  const bars = [...division.frame, ...division.bars].filter((r) => r.z < cutZ && r.z + r.h > cutZ);
  const barHalf = Math.min(GLAZING_BAR_DEPTH, left - right) / 2;
  return group({ class: "window", "data-id": win.id }, [
    polygon(frame, { fill: C.paper, stroke: C.opening, "stroke-width": 0.8 }),
    line(view.toPx(wallPoint(w, a, mid + glassGap)), view.toPx(wallPoint(w, b, mid + glassGap)), {
      stroke: C.glass,
      "stroke-width": 1,
    }),
    line(view.toPx(wallPoint(w, a, mid - glassGap)), view.toPx(wallPoint(w, b, mid - glassGap)), {
      stroke: C.glass,
      "stroke-width": 1,
    }),
    ...bars.map((r) =>
      polygon(
        [
          wallPoint(w, a + r.x, mid - barHalf),
          wallPoint(w, a + r.x + r.w, mid - barHalf),
          wallPoint(w, a + r.x + r.w, mid + barHalf),
          wallPoint(w, a + r.x, mid + barHalf),
        ].map(view.toPx),
        { class: "glazing-bar", fill: C.opening, stroke: "none" },
      ),
    ),
  ]);
}

/** Opening the cut plane misses (e.g. a fanlight): dashed outline over the uncut wall. */
function drawUncut(w: Wall, o: Opening, view: View): Node {
  const outline = openingOutline(w, o).map(view.toPx);
  return group({ class: o.kind, "data-id": o.id, "data-cut": "false" }, [
    polygon(outline, {
      fill: "none",
      stroke: o.kind === "window" ? C.glass : C.dim,
      "stroke-width": 1,
      "stroke-dasharray": "4 2",
    }),
  ]);
}

/**
 * Attributes laid over the plan's own on lines and on text: the plan uses none, and the 3D
 * annotations (`ANNOTATION_LOOK`) draw heavier lines and haloed text to read over the model.
 */
interface Look {
  line?: Attrs;
  text?: Attrs;
}

/** Without the paper underneath, the viewer's annotations need a halo and the lines more weight. */
const ANNOTATION_LOOK: Look = {
  line: { stroke: C.ink, "stroke-width": 1 },
  text: { stroke: C.paper, "stroke-width": 3, "stroke-linejoin": "round", "paint-order": "stroke" },
};

/** Linear dimension between two plan points, offset perpendicular by `offsetPx` (positive = left of p→q). */
function dimension(p: Vec, q: Vec, label: string, offsetPx: number, view: View, look: Look = {}): Node[] {
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
  const tick = (c: Vec) =>
    line(vadd(c, vscale(vadd(u, n), -4)), vadd(c, vscale(vadd(u, n), 4)), {
      stroke: C.dim,
      "stroke-width": 1,
      ...look.line,
    });
  const midPt = vadd(vscale(vadd(P2, Q2), 0.5), vscale(n, 6));
  const angle = (Math.atan2(u.y, u.x) * 180) / Math.PI;
  const upright = angle >= 90 || angle < -90 ? angle + 180 : angle;
  const extensions =
    offsetPx === 0
      ? []
      : [
          line(vadd(P, vscale(n, 4)), vadd(P2, vscale(n, 4)), { stroke: C.dim, "stroke-width": 0.5, ...look.line }),
          line(vadd(Q, vscale(n, 4)), vadd(Q2, vscale(n, 4)), { stroke: C.dim, "stroke-width": 0.5, ...look.line }),
        ];
  return [
    ...extensions,
    line(P2, Q2, { stroke: C.dim, "stroke-width": 0.8, ...look.line }),
    tick(P2),
    tick(Q2),
    text(midPt, label, {
      "font-size": 11,
      fill: C.dim,
      "text-anchor": "middle",
      transform: `rotate(${num(upright)} ${num(midPt.x)} ${num(midPt.y)})`,
      ...look.text,
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
function roomDimensions(id: string, pts: readonly Vec[], label: Bounds, view: View, look: Look = {}): Node[] {
  const b = bounds(pts);
  // Label box in plan mm, widened by the clearance. On a turned sheet its corners map to a turned
  // box, so take the plan bounds of all four.
  const pad = ROOM_DIM_CLEAR / PX_PER_MM;
  const box = bounds(
    [v(label.minX, label.minY), v(label.maxX, label.minY), v(label.maxX, label.maxY), v(label.minX, label.maxY)].map(
      view.toMm,
    ),
  );
  const lo = vsub(v(box.minX, box.minY), v(pad, pad));
  const hi = vadd(v(box.maxX, box.maxY), v(pad, pad));
  const c = vscale(vadd(lo, hi), 0.5);

  const longest = (axis: "x" | "y") => {
    const found: { at: number; span: [number, number]; len: number }[] = [];
    const low = axis === "x" ? b.minX : b.minY;
    const high = axis === "x" ? b.maxX : b.maxY;
    for (let at = low + ROOM_DIM_INSET; at <= high - ROOM_DIM_INSET; at += ROOM_DIM_STEP) {
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
    return dot(vsub(view.toPx(c), P), left) >= 0 === towardLabel
      ? dimension(p, q, `${len}`, 0, view, look)
      : dimension(q, p, `${len}`, 0, view, look);
  };
  const out: Node[] = [];
  const ew = longest("y");
  if (ew) out.push(...draw(v(ew.span[0], ew.at), v(ew.span[1], ew.at), ew.len, ew.clear));
  const ns = longest("x");
  if (ns) out.push(...draw(v(ns.at, ns.span[0]), v(ns.at, ns.span[1]), ns.len, ns.clear));
  return out.length ? [group({ class: "room-dimensions", "data-id": id }, out)] : [];
}

function northArrow(at: Vec, northAngleDeg: number): Node {
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

function scaleBar(at: Vec): Node {
  const segMm = 1000;
  const n = 5;
  const segPx = segMm * PX_PER_MM;
  const parts: Node[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(
      el("rect", {
        x: at.x + i * segPx,
        y: at.y,
        width: segPx,
        height: 6,
        fill: i % 2 ? C.paper : C.ink,
        stroke: C.ink,
        "stroke-width": 0.8,
      }),
    );
    parts.push(text(v(at.x + i * segPx, at.y + 20), `${i}`, { "font-size": 10, "text-anchor": "middle", fill: C.ink }));
  }
  parts.push(text(v(at.x + n * segPx, at.y + 20), `${n} m`, { "font-size": 10, "text-anchor": "middle", fill: C.ink }));
  return group({}, parts);
}

/** Overall dimensions: below and to the right of the drawing extent. */
function overallDimensions(view: View, look: Look = {}): Node[] {
  const { extent } = view;
  const sw = v(extent.minX, extent.minY);
  const se = v(extent.maxX, extent.minY);
  const ne = v(extent.maxX, extent.maxY);
  return [
    ...dimension(sw, se, `${extent.maxX - extent.minX}`, -40, view, look),
    ...dimension(se, ne, `${extent.maxY - extent.minY}`, -40, view, look),
  ];
}

/** Where each room's label goes (its centroid, mm) and what it says. */
export function roomTags(storey: Storey): { id: string; name: string; area: string; at: Vec }[] {
  return storey.rooms.map((r) => {
    const pts = r.outline.map(toVec);
    return { id: r.id, name: r.name, area: m2(area(pts)), at: centroid(pts) };
  });
}

/** Each room's dimensions and, unless `names` is false, its name and area. */
function roomLabels(storey: Storey, view: View, opts: PlanOptions, names = true, look: Look = {}): Node[] {
  const out: Node[] = [];
  for (const r of storey.rooms) {
    const pts = r.outline.map(toVec);
    const c = view.toPx(centroid(pts));
    const { name, area: areaFont } = ROOM_LABEL;
    if (names) {
      out.push(
        text(v(c.x, c.y + name.dy), r.name, {
          "font-size": name.size,
          "font-weight": "bold",
          "text-anchor": "middle",
          fill: C.ink,
          ...look.text,
        }),
      );
      out.push(
        text(v(c.x, c.y + areaFont.dy), m2(area(pts)), {
          "font-size": areaFont.size,
          "text-anchor": "middle",
          fill: C.ink,
          ...look.text,
        }),
      );
    }
    // Rough label extent (px) from character counts; DejaVu Sans averages about 0.6 em per character.
    // Dimensions keep clear of it even when the label is drawn elsewhere (the 3D viewer's billboards).
    const halfW = Math.max(r.name.length * name.size * 0.62, 7 * areaFont.size * 0.6) / 2;
    const dims = (r.dimensionOutline ?? r.outline).map(toVec);
    out.push(
      ...roomDimensions(
        r.id,
        dims,
        { minX: c.x - halfW, maxX: c.x + halfW, minY: c.y - 17, maxY: c.y + (opts.ids ? 29 : 16) },
        view,
        look,
      ),
    );
    if (opts.ids) out.push(text(v(c.x, c.y + 26), r.id, { "font-size": 8, "text-anchor": "middle", fill: C.id }));
  }
  return out;
}

/**
 * An overlay drawing: its primitives in SVG px (1 px = 10 mm, y down, from the drawing's top-left
 * corner), the plan area (mm) they cover edge to edge, and the same primitives as a transparent SVG.
 */
export interface Overlay {
  svg: string;
  bounds: Bounds;
  nodes: Node[];
}

/** A transparent drawing the size of the storey's plan, and the plan area (mm) it covers edge to edge. */
function overlay(storey: Storey, body: (view: View) => Node[]): Overlay {
  const view = makeView(storey);
  const minX = view.extent.minX - MARGIN.left / PX_PER_MM;
  const maxY = view.extent.maxY + MARGIN.top / PX_PER_MM;
  const bounds = { minX, maxY, maxX: minX + view.width / PX_PER_MM, minY: maxY - view.height / PX_PER_MM };
  const nodes = body(view);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}" font-family="${FONT}, sans-serif">`,
    ...nodes.map(serialise),
    "</svg>",
    "",
  ].join("\n");
  return { svg, bounds, nodes };
}

/**
 * The plan's dimensions (room and overall) and, unless `names` is false, its room labels alone,
 * on a transparent background, for laying in the 3D viewer, with haloed text so it reads over the
 * model.
 */
export function renderPlanAnnotations(storey: Storey, { names = true }: { names?: boolean } = {}): Overlay {
  return overlay(storey, (view) => [
    ...roomLabels(storey, view, { ids: false }, names, ANNOTATION_LOOK),
    ...overallDimensions(view, ANNOTATION_LOOK),
  ]);
}

/**
 * Walls, split around the openings they cut, then door and window symbols, as the plan draws them.
 * `doors` picks what a cut door draws: its swing (the plan), its gap in the paper colour (the 3D
 * wall tops, which aren't cut), or nothing.
 */
function wallsAndOpenings(
  storey: Storey,
  view: View,
  components: Components | undefined,
  doors: "swing" | "gap" = "swing",
): Node[] {
  const windowDesigns = new Map((components?.windows ?? []).map((c) => [c.id, c]));
  const doorDesigns = new Map((components?.doors ?? []).map((c) => [c.id, c]));
  const frameWidth = (o: Door) => (o.componentId ? (doorDesigns.get(o.componentId)?.frame?.width ?? 0) : 0);
  const walls = storey.walls.filter((w) => wallLength(w) > 0);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const out: Node[] = [];
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
    else if (o.kind === "window")
      out.push(drawWindow(w, o, view, o.componentId ? windowDesigns.get(o.componentId) : undefined));
    else if (o.doorway) {
      if (doors === "gap") out.push(drawDoorGap(w, o, view));
    } else out.push(doors === "swing" ? drawDoor(w, o, view, frameWidth(o)) : drawDoorGap(w, o, view));
  }
  return out;
}

/** Each cut door's leaf and swing, as on the plan. */
function doorSwings(storey: Storey, view: View, components: Components | undefined): Node[] {
  const wallById = new Map(storey.walls.map((w) => [w.id, w]));
  const doorDesigns = new Map((components?.doors ?? []).map((c) => [c.id, c]));
  return storey.openings.flatMap((o) => {
    const w = wallById.get(o.wallId);
    const frame = o.kind === "door" && o.componentId ? (doorDesigns.get(o.componentId)?.frame?.width ?? 0) : 0;
    return w && o.kind === "door" && !o.doorway && isCut(o) && wallLength(w) > 0 ? [drawDoor(w, o, view, frame)] : [];
  });
}

/**
 * The plan's walls, door gaps and windows alone, on a transparent background, for the 3D viewer to
 * lay over the wall tops, so looking down shows what is in the walls below as the plan does. Door
 * swings go on the floor instead (renderFloor).
 */
export function renderWallTops(storey: Storey, components?: Components): Overlay {
  return overlay(storey, (view) => wallsAndOpenings(storey, view, components, "gap"));
}

/**
 * The plan's floor fills (slab and rooms) and door swings alone, on a transparent background, for
 * the 3D viewer's floor. The slab fills the floor outside the room outlines too: bay windows and
 * alcoves are floor even where they are not part of the room's dimensions.
 */
export function renderFloor(storey: Storey, components?: Components): Overlay {
  return overlay(storey, (view) => [
    ...storey.slabs.map((s) =>
      polygon(
        s.outline.map((p) => view.toPx(toVec(p))),
        { "data-id": s.id, fill: s.material === "ground" ? C.ground : C.room, stroke: "none" },
      ),
    ),
    ...storey.rooms.map((r) =>
      polygon(
        r.outline.map((p) => view.toPx(toVec(p))),
        { "data-id": r.id, fill: C.room, stroke: "none" },
      ),
    ),
    ...doorSwings(storey, view, components),
  ]);
}

/** Every plan point a stair occupies, so the drawing extent includes one outside the rooms. */
function stairPoints(storey: Storey): Vec[] {
  return (storey.stairs ?? []).flatMap((s) =>
    s.segments.flatMap((seg) => (seg.kind === "flight" ? flightFootprint(seg) : seg.outline.map(toVec))),
  );
}

/** The rise a stair climbs, or null when its target storey is missing, which the checks report. */
function stairRise(model: BuildingModel, storey: Storey, s: Stair): number | null {
  const to = model.storeys.find((x) => x.id === s.toStoreyId);
  return to ? to.elevation - storey.elevation : null;
}

/** A flight's walking-direction arrow: a line up the middle with a head towards its end. */
function flightArrow(f: StairFlight, view: View): Node[] {
  const a = toVec(f.start);
  const d = vsub(toVec(f.end), a);
  const at = (t: number) => view.toPx(vadd(a, vscale(d, t)));
  const tip = at(0.82);
  const tail = at(0.68);
  const along = unit(vsub(tip, tail));
  const across = perpLeft(along);
  const head = polygon([tip, vadd(tail, vscale(across, 3.5)), vsub(tail, vscale(across, 3.5))], {
    fill: C.stair,
    stroke: "none",
  });
  return [line(at(0.18), tail, { stroke: C.stair, "stroke-width": 1.2 }), head];
}

/**
 * A winder's walking-direction arrow: a line from the middle of its entry edge through the middle of
 * each fan line, on to where the next flight starts, with a head at the end. Its last point is the
 * flight's start rather than the middle of the exit edge, so it meets the flight's own arrow even when
 * the flight is narrower than the edge.
 */
function winderArrow(path: Vec[], view: View): Node[] {
  const px = path.map(view.toPx);
  const tip = px[px.length - 1]!;
  const along = unit(vsub(tip, px[px.length - 2]!));
  const tail = vsub(tip, vscale(along, 7));
  const across = perpLeft(along);
  const head = polygon([tip, vadd(tail, vscale(across, 3.5)), vsub(tail, vscale(across, 3.5))], {
    fill: C.stair,
    stroke: "none",
  });
  return [polyline(px, { stroke: C.stair, "stroke-width": 1.2 }), head];
}

/** An element id label, in the same style as the wall and opening ones. */
const idLabel = (p: Vec, id: string): Node =>
  text(v(p.x, p.y + 3), id, {
    "font-size": 8,
    "text-anchor": "middle",
    fill: C.id,
    stroke: C.paper,
    "stroke-width": 2.5,
    "stroke-linejoin": "round",
    "paint-order": "stroke",
  });

/**
 * Stairs, drawn in full as the last geometry layer: each flight's footprint, its tread lines and an
 * up arrow, and each landing's outline. Only `renderPlan` draws them — `renderFloor` and
 * `renderWallTops`, which the viewer composites into its plan-style overlay, do not, so the viewer
 * shows a stair as its own IFC geometry.
 */
/**
 * Railings: a line from start to end with a tick at each derived post. Drawn after the walls and
 * before the stairs, so the stairs remain the last geometry layer. Only `renderPlan` draws them.
 */
function drawRailings(storey: Storey, view: View, opts: PlanOptions): Node[] {
  const out: Node[] = [];
  for (const r of storey.railings ?? []) {
    const d = unit(vsub(toVec(r.end), toVec(r.start)));
    const across = v(d.y, -d.x);
    const parts: Node[] = [
      line(view.toPx(toVec(r.start)), view.toPx(toVec(r.end)), { stroke: C.railing, "stroke-width": 1.2 }),
    ];
    for (const p of railingPostPoints(r)) {
      const half = vscale(across, POST_SIZE / 2);
      parts.push(line(view.toPx(vadd(p, half)), view.toPx(vsub(p, half)), { stroke: C.railing, "stroke-width": 1.2 }));
    }
    if (opts.ids) parts.push(idLabel(view.toPx(v((r.start.x + r.end.x) / 2, (r.start.y + r.end.y) / 2)), r.id));
    out.push(group({ class: "railing", "data-id": r.id }, parts));
  }
  return out;
}

function drawStairs(model: BuildingModel, storey: Storey, view: View, opts: PlanOptions): Node[] {
  const out: Node[] = [];
  for (const s of storey.stairs ?? []) {
    const rise = stairRise(model, storey, s);
    const levels = rise === null ? null : stairLevels(s, rise).segments;
    const parts: Node[] = [];
    s.segments.forEach((seg, i) => {
      if (seg.kind === "landing") {
        const pts = seg.outline.map(toVec);
        const body = [polygon(pts.map(view.toPx), { fill: "none", stroke: C.stair, "stroke-width": 1 })];
        if (opts.ids) body.push(idLabel(view.toPx(centroid(pts)), seg.id));
        parts.push(group({ class: "stair-landing", "data-id": seg.id }, body));
        return;
      }
      if (seg.kind === "winder") {
        const fan = winderFan(seg);
        const next = s.segments[i + 1];
        const path = [
          ...fan.walkingLine.slice(0, -1),
          next?.kind === "flight" ? toVec(next.start) : fan.walkingLine.at(-1)!,
        ];
        const outline = seg.outline.map(toVec);
        const body = [
          polygon(outline.map(view.toPx), { fill: "none", stroke: C.stair, "stroke-width": 1 }),
          ...fan.rays.map((r) => line(view.toPx(r.from), view.toPx(r.to), { stroke: C.stair, "stroke-width": 0.7 })),
          ...winderArrow(path, view),
        ];
        if (opts.ids) body.push(idLabel(view.toPx(centroid(outline)), seg.id));
        parts.push(group({ class: "stair-winder", "data-id": seg.id }, body));
        return;
      }
      const level = levels?.[i];
      const going = level?.kind === "flight" ? level.going : 0;
      const body = [
        polygon(flightFootprint(seg).map(view.toPx), { fill: "none", stroke: C.stair, "stroke-width": 1 }),
        ...flightTreads(seg, going).map((t) =>
          line(view.toPx(t.from), view.toPx(t.to), { stroke: C.stair, "stroke-width": 0.7 }),
        ),
        ...flightArrow(seg, view),
      ];
      if (opts.ids)
        body.push(
          idLabel(view.toPx(vadd(toVec(seg.start), vscale(vsub(toVec(seg.end), toVec(seg.start)), 0.4))), seg.id),
        );
      parts.push(group({ class: "stair-flight", "data-id": seg.id }, body));
    });
    if (opts.ids) {
      const pts = stairPoints({ ...storey, stairs: [s] });
      if (pts.length) parts.push(idLabel(view.toPx(centroid(pts)), s.id));
    }
    out.push(group({ class: "stair", "data-id": s.id }, parts));
  }
  return out;
}

export function renderPlan(model: BuildingModel, storey: Storey, opts: PlanOptions): string {
  const northAngle = model.site.northAngle ?? 0;
  const view = makeView(storey, { railings: true, turn: opts.orientation === "project" ? 0 : northAngle });
  const walls = storey.walls.filter((w) => wallLength(w) > 0);
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const out: Node[] = [];

  // Slabs: fill the floor, with a dashed outline beneath everything. Room fills sit on top.
  for (const s of storey.slabs) {
    out.push(
      polygon(
        s.outline.map((p) => view.toPx(toVec(p))),
        {
          class: "slab",
          "data-id": s.id,
          fill: s.material === "ground" ? C.ground : C.room,
          stroke: C.slab,
          "stroke-width": 0.8,
          "stroke-dasharray": "6 3",
        },
      ),
    );
  }

  // Cut door openings show paper over the slab fill, as the viewer's wall tops do. Drawn before the
  // rooms so a room outline that runs into an opening still covers it, as the plan-vs-3D test checks.
  for (const o of storey.openings) {
    const w = wallById.get(o.wallId);
    if (w && o.kind === "door" && isCut(o) && wallLength(w) > 0) out.push(drawDoorGap(w, o, view));
  }

  // Rooms: tinted fill; labels are drawn later so walls never cover them.
  for (const r of storey.rooms) {
    out.push(
      polygon(
        r.outline.map((p) => view.toPx(toVec(p))),
        { class: "room", "data-id": r.id, fill: C.room, stroke: "none" },
      ),
    );
  }

  out.push(...wallsAndOpenings(storey, view, model.components));

  out.push(...drawRailings(storey, view, opts));

  out.push(...drawStairs(model, storey, view, opts));

  out.push(...roomLabels(storey, view, opts));

  if (opts.ids) {
    for (const w of walls) {
      const p = view.toPx(wallPoint(w, wallLength(w) * 0.25, (faceOffsets(w).left + faceOffsets(w).right) / 2));
      out.push(idLabel(p, w.id));
    }
    for (const o of storey.openings) {
      const w = wallById.get(o.wallId);
      if (!w) continue;
      const { left, right } = faceOffsets(w);
      const p = view.toPx(wallPoint(w, o.offsetAlongWall + o.width / 2, (left + right) / 2));
      out.push(idLabel(p, o.id));
    }
  }

  out.push(...overallDimensions(view));

  const title = `${model.building.name} — ${storey.name} plan`;
  const sub = `Elevation ${storey.elevation} mm · dimensions in mm · 1 px = ${num(1 / PX_PER_MM)} mm`;
  out.push(text(v(MARGIN.left, 28), title, { "font-size": 18, "font-weight": "bold", fill: C.ink }));
  out.push(text(v(MARGIN.left, 46), sub, { "font-size": 11, fill: C.dim }));
  // Top right, clear of the overall dimension line below it whichever way the "N" falls.
  out.push(northArrow(v(view.width - 35, 40), northAngle - view.turn));
  out.push(scaleBar(v(MARGIN.left, view.height - 40)));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}" font-family="${FONT}">`,
    serialise(el("rect", { x: 0, y: 0, width: view.width, height: view.height, fill: C.paper })),
    ...out.map(serialise),
    "</svg>",
    "",
  ].join("\n");
}
