/**
 * The 3D viewer's Top view, in plan style, must show the same walls, rooms and openings as the
 * plan. Builds each model into a temporary folder, serves it with the viewer, reads the WebGL
 * canvas back and compares it with the plan's own pixels (tests/support/plan-vs-3d.ts).
 *
 * The viewer tests are split over this file, viewer-storey-keys.test.ts and
 * viewer-presentation.test.ts so CI can run them on separate runners; they share
 * tests/support/viewer-page.ts.
 */
import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import { renderPlan } from "../src/render/plan.js";
import { svgToPixels } from "../src/render/png.js";
import { MARGIN, PNG_ZOOM } from "../src/render/style.js";
import { C } from "../src/render/style.js";
import type { BuildingModel, Storey } from "../src/schema/schema.js";
import { comparePlanTo3d, isIgnoredColour, type Raster } from "./support/plan-vs-3d.js";
import { canvasPixels, model, page, publish, samePixels, selectStorey, topView, useViewer, viewOf } from "./support/viewer-page.js";

useViewer();

/** The plan's drawing area only: the sheet furniture (title, north arrow, scale bar) is ink that
 * antialiases through the wall grey and would inflate the comparator's wall box, which the viewer's
 * top view has no equivalent of. Margins are in SVG px; the raster is PNG_ZOOM times that. */
const planPixels = (m: BuildingModel, storey: Storey = m.storeys[0]!): Raster => {
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

describe("plan colours", () => {
  it("ignores ground and railing pixels in the plan-versus-3D comparison", () => {
    expect(isIgnoredColour(C.ground)).toBe(true);
    expect(isIgnoredColour(C.railing)).toBe(true);
  });
});

describe("3D Top view against the plan", () => {
  // Every walled storey of every model, each against the top view of that storey alone: with more
  // than one storey shown the top view reads as the topmost storey's plan, not the one compared.
  // Wall-less external storeys (the street level) are covered by the ground-presentation test.
  for (const [path, source] of [
    ["models/examples/example-cottage", cottage],
    ["models/elmstead", elmstead],
    ["tests/fixtures/two-storey", twoStorey],
  ] as const) {
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

  it("catches a room outline that runs to a wall's centreline (the lobby door gap shows room fill on the plan only)", async () => {
    // Elmstead as first traced: the hallway and lobby both ran to the diagonal lobby screen's
    // centreline, so on the plan the lobby door's gap showed room fill, in 3D a white gap.
    const m = structuredClone(await model("models/elmstead"));
    const storey = m.storeys.find((s) => s.id === "storey-ground")!;
    const screen = storey.walls.find((w) => w.id === "wall-lobby-screen")!;
    const hallway = storey.rooms.find((r) => r.id === "room-hallway")!;
    const lobby = storey.rooms.find((r) => r.id === "room-lobby")!;
    expect([hallway.outline.length, lobby.outline.length]).toEqual([6, 5]);
    hallway.outline.splice(1, 2, screen.start, screen.end);
    lobby.outline.splice(3, 2, screen.end, screen.start);
    await publish("test-elmstead-centreline", m);
    // Finer tiles than the default: the defect is a door gap, a band only as deep as the wall, which
    // a 500 mm tile dilutes below the comparator's 25%-comparable threshold.
    const r = comparePlanTo3d(planPixels(m, storey), await topView("test-elmstead-centreline", "storey-ground"), { tile: 250, step: 125 });
    expect(r.badTiles.length).toBeGreaterThan(0);
    // Some tile covers the screen, whose wall runs from (4.691, 6.462) to (5.484, 7.129) m.
    const over = r.badTiles.find((t) => t.x[0] < 5.484 && t.x[1] > 4.691 && t.y[0] < 7.165 && t.y[1] > 6.462);
    expect(over, `screen tiles among ${r.badTiles.length}: ${JSON.stringify(r.badTiles.slice(0, 4))}`).toBeDefined();
  }, 120_000);
});

describe("storey selection", () => {
  it("notes an unknown storey id in the status line and shows everything", async () => {
    const m = await model("models/examples/example-cottage");
    await publish("test-unknown-storey", m);
    await viewOf("test-unknown-storey", "view=top&snapshot=1&labels=0&style=plan&storeys=storey-nope");
    expect(await page.textContent("#status")).toContain('no storey "storey-nope"');
  }, 120_000);

  it("hides a storey's geometry, not just its drawings", async () => {
    // This identity is about storey geometry, so compare a stair-less copy: a stair's parts are
    // aggregated under an IfcStair and fragments does not hide them per-item with their storey, so
    // stair visibility across storeys is a separate follow-up. Hide the top storey (the attic)
    // above every other storey, and compare with a model that never had it.
    const m = structuredClone(await model("models/elmstead"));
    for (const s of m.storeys) s.stairs = [];
    await publish("test-hidden-storey", m);
    const belowTop = structuredClone(m);
    belowTop.storeys = belowTop.storeys.filter((s) => s.id !== "storey-attic");
    await publish("test-below-top", belowTop);
    // A fixed camera keeps the framing identical regardless of the hidden storey's bounds, so the
    // comparison isolates geometry hiding rather than sub-pixel drift in the auto-framing.
    const camera = "16,11,6,5.2,1.5,-4.2";
    const hidden = await viewOf("test-hidden-storey", `view=se&snapshot=1&labels=0&style=ifc&camera=${camera}&storeys=storey-basement,storey-street,storey-ground,storey-main-half-landing,storey-first-floor,storey-attic-half-landing`);
    const absent = await viewOf("test-below-top", `view=se&snapshot=1&labels=0&style=ifc&camera=${camera}`);
    // Hiding a storey must be the same picture as a model that never had it: same pixels, every one
    // of them. The camera is pinned by the URL, so this proves geometry hiding but not hiding under
    // auto-framing (which drifts sub-pixel with the hidden storey's bounds); that is a known gap.
    expect(Buffer.from(hidden.data).equals(Buffer.from(absent.data))).toBe(true);
  }, 120_000);

  it("shows the chosen floor and every storey below it, without moving the camera", async () => {
    const m = await model("models/elmstead");
    await publish("test-storey-selector", m);
    // A fixed camera makes a re-frame detectable: both pictures must come from the same viewpoint.
    const camera = "16,11,6,5.2,1.5,-4.2";
    const all = await viewOf("test-storey-selector", `view=top&labels=0&style=plan&camera=${camera}`);

// The ground choice is the basement, street and ground together, from the camera it had before.
    await selectStorey("storey-ground");
    expect(new URL(page.url()).searchParams.get("storeys")).toBe("storey-basement,storey-street,storey-ground");
    const ground = await canvasPixels();
    expect(samePixels(ground, all)).toBe(false);
    const groundOnly = await viewOf("test-storey-selector", `view=top&labels=0&style=plan&camera=${camera}&storeys=storey-basement,storey-street,storey-ground`);
    expect(samePixels(ground, groundOnly)).toBe(true);

    // The topmost choice puts the attic back, still without moving the camera.
    await selectStorey("storey-attic");
    expect(new URL(page.url()).searchParams.has("storeys")).toBe(false);
    expect(samePixels(await canvasPixels(), all)).toBe(true);

    // A URL subset no single floor describes reads as custom rather than as some floor.
    await viewOf("test-storey-selector", `view=top&labels=0&style=plan&camera=${camera}&storeys=storey-first-floor`);
    const picker = await page.evaluate(() => {
      const s = document.getElementById("storeys") as HTMLSelectElement;
      return { value: s.value, text: s.selectedOptions[0]?.textContent };
    });
    expect(picker).toEqual({ value: "", text: "Custom" });
  }, 120_000);
});
