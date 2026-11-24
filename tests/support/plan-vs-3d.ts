/**
 * Compares the 3D viewer's plan-style Top view with the plan PNG, by what each pixel shows: wall
 * (charcoal), room fill (cream) or paper (white). Text, lines, glazing and antialiased edges are
 * neither and are ignored, so the comparison is about geometry, not styling.
 *
 * The two images are aligned by the walls' charcoal extent (the outer walls in both), then compared
 * in overlapping tiles: a mismatch confined to a small area (one door gap) would vanish in a
 * whole-image percentage but stands out in its tile.
 */
import { C, PNG_ZOOM, PX_PER_MM } from "../../src/render/style.js";

/** RGBA, row-major, 4 bytes per pixel. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

const enum Kind {
  Other,
  Wall,
  Room,
  Paper,
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const KINDS: [Kind, [number, number, number]][] = [
  [Kind.Wall, rgb(C.wall)],
  [Kind.Room, rgb(C.room)],
  [Kind.Paper, rgb(C.paper)],
];
/** Per-channel tolerance. Room and paper differ by 12–25 per channel, so this must stay below 6. */
const TOLERANCE = 5;

function kindAt(r: Raster, x: number, y: number): Kind {
  const i = (y * r.width + x) * 4;
  for (const [kind, [cr, cg, cb]] of KINDS) {
    if (Math.abs(r.data[i]! - cr) <= TOLERANCE && Math.abs(r.data[i + 1]! - cg) <= TOLERANCE && Math.abs(r.data[i + 2]! - cb) <= TOLERANCE) return kind;
  }
  return Kind.Other;
}

/** Whether the comparison ignores this opaque colour, as it does stair and ground pixels. */
export function isIgnoredColour(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return kindAt({ width: 1, height: 1, data: new Uint8Array([r, g, b, 255]) }, 0, 0) === Kind.Other;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Extent of the wall-coloured pixels. Antialiased text passes through the wall grey too, so only
 * rows and columns with at least `minRun` of it count: walls are tens of pixels thick.
 */
export function wallBox(r: Raster, minRun: number): Box {
  const rows = new Uint32Array(r.height);
  const cols = new Uint32Array(r.width);
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      if (kindAt(r, x, y) === Kind.Wall) {
        rows[y]!++;
        cols[x]!++;
      }
    }
  }
  const first = (a: Uint32Array) => a.findIndex((n) => n >= minRun);
  const last = (a: Uint32Array) => a.length - 1 - [...a].reverse().findIndex((n) => n >= minRun);
  const box = { x0: first(cols), y0: first(rows), x1: last(cols) + 1, y1: last(rows) + 1 };
  if (box.x0 < 0 || box.y0 < 0) throw new Error("no walls found in the image");
  return box;
}

export interface TileMismatch {
  /** Tile extent in metres from the outer walls' south-west corner (x east, y north). */
  x: [number, number];
  y: [number, number];
  /** Share of the tile's comparable pixels that show different things. */
  mismatch: number;
}

export interface Comparison {
  /** Plan scale ÷ 3D scale across and down; equal when the 3D view is undistorted. */
  aspect: number;
  /** Pixels of the plan's wall box (plus margin) that both images classify. */
  compared: number;
  /** Share of those that differ. */
  mismatch: number;
  /** Tiles whose mismatch exceeds the limit, worst first. */
  badTiles: TileMismatch[];
}

export interface CompareOptions {
  /** Tile size and step, mm. */
  tile?: number;
  step?: number;
  /** A tile fails above this share of mismatched pixels. */
  tileLimit?: number;
}

/** Compare the plan (as rendered to PNG) with a screenshot of the 3D Top view in plan style. */
export function comparePlanTo3d(plan: Raster, top: Raster, { tile = 500, step = 250, tileLimit = 0.1 }: CompareOptions = {}): Comparison {
  // The two rasters antialias their outer wall edges differently, and no tolerance can make a
  // 1-pixel gradient agree across scales, so the comparison stays a few pixels inside the wall box.
  const inset = 3;
  const pb0 = wallBox(plan, 120);
  const tb0 = wallBox(top, 80);
  const pb = { x0: pb0.x0 + inset, y0: pb0.y0 + inset, x1: pb0.x1 - inset, y1: pb0.y1 - inset };
  const tb = { x0: tb0.x0 + inset, y0: tb0.y0 + inset, x1: tb0.x1 - inset, y1: tb0.y1 - inset };
  const sx = (tb.x1 - tb.x0) / (pb.x1 - pb.x0);
  const sy = (tb.y1 - tb.y0) / (pb.y1 - pb.y0);
  const pxPerMm = PX_PER_MM * PNG_ZOOM;

  // Classify each image over its wall box once. The two images are at different scales, so their
  // kind boundaries fall a pixel apart; a pixel next to a boundary in either image is that
  // registration artifact, not a disagreement about the model, and is skipped.
  const classify = (r: Raster, b: Box) => {
    const w = b.x1 - b.x0;
    const g = new Int8Array(w * (b.y1 - b.y0));
    for (let y = 0; y < b.y1 - b.y0; y++) for (let x = 0; x < w; x++) g[y * w + x] = kindAt(r, b.x0 + x, b.y0 + y);
    return g;
  };
  const onEdge = (g: Int8Array, w: number, h: number, x: number, y: number) => {
    const k = g[y * w + x]!;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (g[ny * w + nx] !== k) return true;
      }
    }
    return false;
  };
  const pk = classify(plan, pb);
  const tk = classify(top, tb);
  const tw = tb.x1 - tb.x0;
  const th = tb.y1 - tb.y0;

  // Per plan pixel inside the wall box: 0 = not comparable, 1 = same, 2 = different.
  const w = pb.x1 - pb.x0;
  const h = pb.y1 - pb.y0;
  const cmp = new Uint8Array(w * h);
  let compared = 0;
  let different = 0;
  for (let y = 0; y < h; y++) {
    const ty = Math.round(tb.y0 + (y + 0.5) * sy - 0.5) - tb.y0;
    for (let x = 0; x < w; x++) {
      const tx = Math.round(tb.x0 + (x + 0.5) * sx - 0.5) - tb.x0;
      if (tx < 0 || ty < 0 || tx >= tw || ty >= th) continue;
      const a = pk[y * w + x]!;
      const b = tk[ty * tw + tx]!;
      if (a === Kind.Other || b === Kind.Other) continue;
      if (onEdge(pk, w, h, x, y) || onEdge(tk, tw, th, tx, ty)) continue;
      compared++;
      const differs = a !== b;
      if (differs) different++;
      cmp[y * w + x] = differs ? 2 : 1;
    }
  }

  const badTiles: TileMismatch[] = [];
  const t = Math.round(tile * pxPerMm);
  const s = Math.round(step * pxPerMm);
  for (let y0 = 0; y0 < h; y0 += s) {
    for (let x0 = 0; x0 < w; x0 += s) {
      let n = 0;
      let d = 0;
      for (let y = y0; y < Math.min(h, y0 + t); y++) {
        for (let x = x0; x < Math.min(w, x0 + t); x++) {
          const c = cmp[y * w + x]!;
          if (c) n++;
          if (c === 2) d++;
        }
      }
      // Tiles mostly of text, lines or antialiasing say little either way.
      if (n < 0.25 * t * t || d / n <= tileLimit) continue;
      const m = (px: number) => Math.round((px / pxPerMm / 1000) * 100) / 100;
      badTiles.push({ x: [m(x0), m(Math.min(w, x0 + t))], y: [m(h - Math.min(h, y0 + t)), m(h - y0)], mismatch: Math.round((d / n) * 1000) / 1000 });
    }
  }
  badTiles.sort((a, b) => b.mismatch - a.mismatch);
  return { aspect: sx / sy, compared, mismatch: compared ? different / compared : 0, badTiles };
}
