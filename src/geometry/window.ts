import type { Window, WindowComponent } from "../schema/schema.js";

/** Depth (mm, across the wall) of glazing bars; deeper than the glass so they stand proud of it. */
export const GLAZING_BAR_DEPTH = 70;

/** A rectangle in the window's own elevation: x from its left edge, z up from its sill, mm. */
export interface Rect {
  x: number;
  z: number;
  w: number;
  h: number;
}

/**
 * How a window's opening divides into glass panes and the bars between them, from its component's
 * `glazing` (ratios, so one design fits any size). Without glazing it is one pane.
 *
 * The pieces never overlap: vertical bars run the full height, and horizontal bars run only between
 * them. So their areas add up to the opening's, and volumes can be checked exactly.
 */
export function windowDivision(win: Pick<Window, "width" | "height">, glazing?: WindowComponent["glazing"]): { panes: Rect[]; bars: Rect[] } {
  if (!glazing) return { panes: [{ x: 0, z: 0, w: win.width, h: win.height }], bars: [] };
  const { columns, rows, barWidth: b } = glazing;
  const cols = spans(win.width, columns, b);
  const levels = spans(win.height, rows, b);
  const panes: Rect[] = [];
  const bars: Rect[] = [];
  cols.forEach(([x, w], i) => {
    if (i > 0) bars.push({ x: x - b, z: 0, w: b, h: win.height });
    levels.forEach(([z, h], j) => {
      panes.push({ x, z, w, h });
      if (j > 0) bars.push({ x, z: z - b, w, h: b });
    });
  });
  return { panes, bars };
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
