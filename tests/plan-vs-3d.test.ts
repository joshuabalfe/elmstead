/**
 * The 3D viewer's Top view, in plan style, must show the same walls, rooms and openings as the
 * plan. Builds each model into a temporary folder, serves it with the viewer, reads the WebGL
 * canvas back and compares it with the plan's own pixels (tests/support/plan-vs-3d.ts).
 *
 * Chromium comes with npm install (@playwright/browser-chromium, pinned to playwright's version).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatJson } from "../src/cli/json-format.js";
import { loadModel } from "../src/cli/load.js";
import { writeIfc } from "../src/ifc/writer.js";
import cottage from "../models/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import twoStorey from "../models/example-two-storey/index.js";
import { renderPlan } from "../src/render/plan.js";
import { svgToPixels } from "../src/render/png.js";
import { MARGIN, PNG_ZOOM } from "../src/render/style.js";
import type { BuildingModel, Storey } from "../src/schema/schema.js";
import { comparePlanTo3d, type Raster } from "./support/plan-vs-3d.js";

declare global {
  interface Window {
    __elmsteadStoreyChanges?: number;
  }
}

const VIEWPORT = { width: 1600, height: 1200 };

let outDir: string;
let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let page: Page;

async function model(path: string): Promise<BuildingModel> {
  const r = await loadModel(path);
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("\n"));
  return r.value.model;
}

/** Write the model where the viewer reads it, as `build` would. */
async function publish(name: string, m: BuildingModel) {
  writeFileSync(join(outDir, `${name}.building.json`), formatJson(m));
  writeFileSync(join(outDir, `${name}.ifc`), await writeIfc(m, { fileName: `${name}.ifc` }));
}

/** The viewer's canvas as raw pixels. */
async function canvasPixels(): Promise<Raster> {
  const { width, height, b64 } = await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>("#container canvas")!;
    const c = document.createElement("canvas");
    [c.width, c.height] = [gl.width, gl.height];
    const ctx = c.getContext("2d")!;
    ctx.drawImage(gl, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let s = "";
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
    return { width: c.width, height: c.height, b64: btoa(s) };
  });
  return { width, height, data: new Uint8Array(Buffer.from(b64, "base64")) };
}

/** The viewer's canvas as raw pixels, for any query string. */
async function viewOf(name: string, query: string): Promise<Raster> {
  const url = server!.resolvedUrls!.local[0]!;
  await page.goto(`${url}?model=${encodeURIComponent(name)}&${query}`);
  await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
  const failed = await page.evaluate(() => window.__elmsteadError);
  if (failed) throw new Error(`viewer failed: ${failed}`);
  return canvasPixels();
}

const samePixels = (a: Raster, b: Raster) => a.width === b.width && a.height === b.height && Buffer.from(a.data).equals(Buffer.from(b.data));

/** Choose a floor in the bar and wait until the viewer has applied and drawn it. */
async function selectStorey(id: string) {
  const before = await page.evaluate(() => window.__elmsteadStoreyChanges ?? 0);
  await page.selectOption("#storeys", id);
  await page.waitForFunction((n: number) => (window.__elmsteadStoreyChanges ?? 0) > n, before, { timeout: 60_000 });
}

/** The viewer's Top view in plan style, labels off, as raw pixels from its WebGL canvas. */
async function topView(name: string, storeyId?: string): Promise<Raster> {
  const storeys = storeyId ? `&storeys=${encodeURIComponent(storeyId)}` : "";
  return viewOf(name, `view=top&snapshot=1&labels=0&style=plan${storeys}`);
}

/** The plan's drawing area only: the sheet furniture (title, north arrow, scale bar) is ink that
 * antialiases through the wall grey and would inflate the comparator's wall box, which the viewer's
 * top view has no equivalent of. Margins are in SVG px; the raster is PNG_ZOOM times that. */
const planPixels = (m: BuildingModel, storey: Storey = m.storeys[0]!): Raster => {
  const full = svgToPixels(renderPlan(m, storey, { ids: false }));
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

beforeAll(async () => {
  try {
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  } catch (e) {
    if (/Executable doesn't exist|playwright install/i.test(String(e))) throw new Error("Chromium missing — it comes with npm install (@playwright/browser-chromium); if install scripts were skipped, run: npm rebuild @playwright/browser-chromium");
    throw e;
  }
  outDir = mkdtempSync(join(tmpdir(), "elmstead-plan-vs-3d-"));
  process.env.ELMSTEAD_OUT_DIR = outDir;
  server = await createServer({ configFile: "viewer/vite.config.ts", server: { port: 0 }, logLevel: "error" });
  await server.listen();
  page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  delete process.env.ELMSTEAD_OUT_DIR;
  if (outDir) rmSync(outDir, { recursive: true, force: true });
  // Closing Chromium after three swiftshader WebGL pages can exceed the default 10 s on CI.
}, 60_000);

describe("3D Top view against the plan", () => {
  // Every storey of every model, each against the top view of that storey alone: with more than one
  // storey shown the top view reads as the topmost storey's plan, not the one being compared.
  for (const [path, source] of [
    ["models/example-cottage", cottage],
    ["models/elmstead", elmstead],
    ["models/example-two-storey", twoStorey],
  ] as const) {
    for (const storey of source.storeys) {
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
    const m = await model("models/example-cottage");
    await publish("test-unknown-storey", m);
    await viewOf("test-unknown-storey", "view=top&snapshot=1&labels=0&style=plan&storeys=storey-nope");
    expect(await page.textContent("#status")).toContain('no storey "storey-nope"');
  }, 120_000);

  it("hides a storey's geometry, not just its drawings", async () => {
    // This identity is about storey geometry, so compare a stair-less copy: a stair's parts are
    // aggregated under an IfcStair and fragments does not hide them per-item with their storey, so
    // stair visibility across storeys is a separate follow-up. Hide the top storey (the first floor)
    // above the basement and ground, and compare with a model that never had it.
    const m = structuredClone(await model("models/elmstead"));
    for (const s of m.storeys) s.stairs = [];
    await publish("test-hidden-storey", m);
    const belowFirst = structuredClone(m);
    belowFirst.storeys = belowFirst.storeys.filter((s) => s.id !== "storey-first-floor");
    await publish("test-below-first", belowFirst);
    const hidden = await viewOf("test-hidden-storey", "view=se&snapshot=1&labels=0&style=ifc&storeys=storey-basement,storey-ground");
    const absent = await viewOf("test-below-first", "view=se&snapshot=1&labels=0&style=ifc");
    // Hiding a storey must be the same picture as a model that never had it: same framing, same
    // pixels, every one of them.
    expect(Buffer.from(hidden.data).equals(Buffer.from(absent.data))).toBe(true);
  }, 120_000);

  it("shows the chosen floor and every storey below it, without moving the camera", async () => {
    const m = await model("models/elmstead");
    await publish("test-storey-selector", m);
    // A fixed camera makes a re-frame detectable: both pictures must come from the same viewpoint.
    const camera = "16,11,6,5.2,1.5,-4.2";
    const all = await viewOf("test-storey-selector", `view=top&labels=0&style=plan&camera=${camera}`);

    // The ground choice is the ground and the basement below it, from the camera it had before.
    await selectStorey("storey-ground");
    expect(new URL(page.url()).searchParams.get("storeys")).toBe("storey-basement,storey-ground");
    const ground = await canvasPixels();
    expect(samePixels(ground, all)).toBe(false);
    const groundOnly = await viewOf("test-storey-selector", `view=top&labels=0&style=plan&camera=${camera}&storeys=storey-basement,storey-ground`);
    expect(samePixels(ground, groundOnly)).toBe(true);

    // The topmost choice puts the first floor back, still without moving the camera.
    await selectStorey("storey-first-floor");
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

describe("stair readability presentation", () => {
  const near = (r: Raster, rgb: [number, number, number], tol: number): number => {
    let n = 0;
    for (let i = 0; i < r.data.length; i += 4) {
      if (Math.abs(r.data[i]! - rgb[0]) <= tol && Math.abs(r.data[i + 1]! - rgb[1]) <= tol && Math.abs(r.data[i + 2]! - rgb[2]) <= tol) n++;
    }
    return n;
  };
  const green: [number, number, number] = [92, 138, 84]; // the IFC stair colour
  const darkCream: [number, number, number] = [209, 206, 198]; // the lit darker tread band

  it("shows the cream tread bands in plan, IFC style and snapshots alike", async () => {
    const m = await model("models/elmstead");
    await publish("test-stair-presentation", m);
    // A stair-less copy isolates the stair's own band pixels from shaded walls of the same tone.
    const noStair = structuredClone(m);
    for (const s of noStair.storeys) s.stairs = [];
    await publish("test-stair-noband", noStair);
    const q = "view=top&labels=0&storeys=storey-ground";
    for (const style of ["plan", "plan&snapshot=1", "ifc"]) {
      const withStair = await viewOf("test-stair-presentation", `${q}&style=${style}`);
      const without = await viewOf("test-stair-noband", `${q}&style=${style}`);
      // The recolour replaces the base IFC green, and the stair adds darker tread bands.
      expect(near(withStair, green, 12)).toBeLessThan(50);
      expect(near(withStair, darkCream, 8) - near(without, darkCream, 8)).toBeGreaterThan(1000);
    }
  }, 120_000);
});
