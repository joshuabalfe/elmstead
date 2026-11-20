/** Elmstead's window designs. Sizes are each window's own (../ground/openings.ts). */
import { mm, windowComponent } from "../../../src/model/index.js";

/**
 * The large front window: a horizontal bar half way up, and three panes across it in the ratio
 * 1:2:1, so six panes. Bar width is a typical 60 mm; the owner gave the layout, not the bars.
 */
export const frontWindow = windowComponent("window-type-front", "Front window", {
  glazing: { columns: [1, 2, 1], rows: [1, 1], barWidth: mm(60) },
});
/** The glazed panel over the front door: a different construction from the front window. */
export const fanlight = windowComponent("window-type-fanlight", "Fanlight");
/** The bedroom and rear-hall windows. */
export const standardWindow = windowComponent("window-type-standard", "Standard window");
