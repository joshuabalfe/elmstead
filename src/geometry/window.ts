import type { Window, WindowComponent } from "../schema/schema.js";

/** Depth (mm, across the wall) of frames and glazing bars; deeper than the glass so they stand proud of it. */
export const GLAZING_BAR_DEPTH = 70;
/** Thickness of the simple door leaf / glazing panel bodies. */
export const PANEL_THICKNESS = 50;

/** A rectangle in the window's own elevation: x from its left edge, z up from its sill, mm. */
export interface Rect {
  x: number;
  z: number;
  w: number;
  h: number;
}

export interface WindowDivision {
  panes: Rect[];
  bars: Rect[];
  frame: Rect[];
}

/**
 * How a window's opening divides into frame, glass panes and the bars between them, from its
 * component (ratios and widths, so one design fits any size). Without either it is one pane.
 *
 * The pieces never overlap: the frame's head and sill run the full width with the jambs between
 * them; inside it, vertical bars run the full height and horizontal bars only between them. So
 * their areas add up to the opening's, and volumes can be checked exactly.
 */
export function windowDivision(win: Pick<Window, "width" | "height">, design?: Pick<WindowComponent, "glazing" | "frame">): WindowDivision {
  const f = design?.frame?.width ?? 0;
  const frame: Rect[] = f
    ? [
        { x: 0, z: 0, w: win.width, h: f },
        { x: 0, z: win.height - f, w: win.width, h: f },
        { x: 0, z: f, w: f, h: win.height - 2 * f },
        { x: win.width - f, z: f, w: f, h: win.height - 2 * f },
      ]
    : [];
  const inner = { x: f, z: f, w: win.width - 2 * f, h: win.height - 2 * f };
  const glazing = design?.glazing;
  if (!glazing) return { panes: [inner], bars: [], frame };
  const { columns, rows, barWidth: b } = glazing;
  const cols = spans(inner.w, columns, b);
  const levels = spans(inner.h, rows, b);
  const panes: Rect[] = [];
  const bars: Rect[] = [];
  cols.forEach(([x, w], i) => {
    if (i > 0) bars.push({ x: inner.x + x - b, z: inner.z, w: b, h: inner.h });
    levels.forEach(([z, h], j) => {
      panes.push({ x: inner.x + x, z: inner.z + z, w, h });
      if (j > 0) bars.push({ x: inner.x + x, z: inner.z + z - b, w, h: b });
    });
  });
  return { panes, bars, frame };
}

/** [start, size] of each pane along a length split by bars `b` wide, panes in the given ratios. */
function spans(length: number, ratios: readonly number[], b: number): [number, number][] {
  const glass = length - (ratios.length - 1) * b;
  const total = ratios.reduce((a, r) => a + r, 0);
  let at = 0;
  return ratios.map((r) => {
    const size = (glass * r) / total;
    const span: [number, number] = [at, size];
    at += size + b;
    return span;
  });
}
