/**
 * Compares the viewer's Top view with the plan, storey by storey, for the plan-vs-3d test files.
 * One model per file keeps each file short enough for CI to run them side by side.
 */
import { expect, it } from "vitest";
import { renderPlan } from "../../src/render/plan.js";
import { svgToPixels } from "../../src/render/png.js";
import { MARGIN, PNG_ZOOM } from "../../src/render/style.js";
import type { BuildingModel, Storey } from "../../src/schema/schema.js";
import { comparePlanTo3d, type Raster } from "./plan-vs-3d.js";
import { publish, topView } from "./viewer-page.js";

/** The plan's drawing area only: the sheet furniture (title, north arrow, scale bar) is ink that
 * antialiases through the wall grey and would inflate the comparator's wall box, which the viewer's
 * top view has no equivalent of. Margins are in SVG px; the raster is PNG_ZOOM times that. */
export const planPixels = (m: BuildingModel, storey: Storey = m.storeys[0]!): Raster => {
  const full = svgToPixels(renderPlan(m, storey, { ids: false, orientation: "project" }));
  const x0 = MARGIN.left * PNG_ZOOM;
  const y0 = MARGIN.top * PNG_ZOOM;
  const x1 = full.width - MARGIN.right * PNG_ZOOM;
  const y1 = full.height - MARGIN.bottom * PNG_ZOOM;
  const w = x1 - x0;
  const h = y1 - y0;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) data.set(full.data.subarray(((y0 + y) * full.width + x0) * 4, ((y0 + y) * full.width + x1) * 4), y * w * 4);
  return { width: w, height: h, data };
};

/** Registers a test per comparable storey of each model, inside the caller's describe. */
export function compareEveryStorey(models: readonly (readonly [path: string, source: BuildingModel])[]) {
  // Every walled storey of every model, each against the top view of that storey alone: with more
  // than one storey shown the top view reads as the topmost storey's plan, not the one compared.
  // Wall-less external storeys (the street level) are covered by the ground-presentation test.
  for (const [path, source] of models) {
    // A storey with pitched walls is skipped: this compares the plan's horizontal cut poché with the
    // 3D top view, which agree for flat-topped walls but not for a sloped top (its cut footprint and
    // its top projection differ). Comparing pitched walls against a top-view plan is a follow-up.
    // The comparator aligns the two pictures on the walls' extent, counting only pixel rows and
    // columns with walls a whole floor's worth across. A storey whose walls span less than 2 m either
    // way (Elmstead's half landings, framed by the 1.4 m extension) gives it nothing to align on.
    const span = (s: Storey, axis: "x" | "y") => {
      const v = s.walls.flatMap((w) => [w.start[axis], w.end[axis]]);
      return Math.max(...v) - Math.min(...v);
    };
    const comparable = (s: Storey) => s.walls.length > 0 && span(s, "x") >= 2000 && span(s, "y") >= 2000 && !s.walls.some((w) => w.profile);
    for (const storey of source.storeys.filter(comparable)) {
      it(`shows the same walls, rooms and openings as the plan: ${path} ${storey.id}`, async () => {
        const m = structuredClone(source) as BuildingModel;
        const name = `test-${path.replace(/\W+/g, "-")}`;
        await publish(name, m);
        const r = comparePlanTo3d(planPixels(m, m.storeys.find((s) => s.id === storey.id)!), await topView(name, storey.id));
        expect(r.aspect).toBeCloseTo(1, 2); // undistorted
        expect(r.compared).toBeGreaterThan(100_000);
        expect(r.badTiles, "tiles where the 3D view shows something else than the plan").toEqual([]);
        expect(r.mismatch).toBeLessThan(0.01);
      }, 120_000);
    }
  }
}
