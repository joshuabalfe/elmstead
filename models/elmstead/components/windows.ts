/** Elmstead's window designs. Sizes are each window's own (../ground/openings.ts). */
import { mm, windowComponent } from "../../../src/model/index.js";

/**
 * The large front window: a 100 mm frame all round, inside the window's size, then a horizontal bar
 * half way up and three panes across in the ratio 1:3:1, so six panes. Bar width is a typical
 * 60 mm; the owner gave the frame and the layout, not the bars.
 */
export const frontWindow = windowComponent("window-type-front", "Front window", {
  frame: { width: mm(100) },
  glazing: { columns: [1, 3, 1], rows: [1, 1], barWidth: mm(60) },
});
/** The glazed panel over the front door: a different construction from the front window. */
export const fanlight = windowComponent("window-type-fanlight", "Fanlight");
/**
 * The canted bay's middle window: the front window's 100 mm frame and 60 mm bars, with one
 * vertical and one horizontal bar, so four panes.
 */
export const bayWindow = windowComponent("window-type-bay", "Bay window", {
  frame: { width: mm(100) },
  glazing: { columns: [1, 1], rows: [1, 1], barWidth: mm(60) },
});
/**
 * The bay's side lights: the front window's 100 mm frame and 60 mm bars, with a single horizontal
 * bar and no vertical bars, so two panes.
 */
export const crossBarWindow = windowComponent("window-type-cross-bar", "Cross-bar window", {
  frame: { width: mm(100) },
  glazing: { columns: [1], rows: [1, 1], barWidth: mm(60) },
});
/** The first-floor kitchen window: the same frame and bars, with one vertical bar as well. */
export const crossWindow = windowComponent("window-type-cross", "Cross window", {
  frame: { width: mm(100) },
  glazing: { columns: [1, 1], rows: [1, 1], barWidth: mm(60) },
});
/** The bedroom and rear-hall windows. */
export const standardWindow = windowComponent("window-type-standard", "Standard window");
