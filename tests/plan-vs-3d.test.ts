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
import { renderPlan } from "../src/render/plan.js";
import { svgToPixels } from "../src/render/png.js";
import type { BuildingModel } from "../src/schema/schema.js";
import { comparePlanTo3d, type Raster } from "./support/plan-vs-3d.js";

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

/** The viewer's Top view in plan style, labels off, as raw pixels from its WebGL canvas. */
async function topView(name: string): Promise<Raster> {
  const url = server!.resolvedUrls!.local[0]!;
  await page.goto(`${url}?model=${encodeURIComponent(name)}&view=top&snapshot=1&labels=0&style=plan`);
  await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
  const failed = await page.evaluate(() => window.__elmsteadError);
  if (failed) throw new Error(`viewer failed: ${failed}`);
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

const planPixels = (m: BuildingModel): Raster => svgToPixels(renderPlan(m, m.storeys[0]!, { ids: false }));

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
  for (const path of ["models/example-cottage", "models/elmstead", "models/example-two-storey"]) {
    it(`shows the same walls, rooms and openings as the plan: ${path}`, async () => {
      const m = await model(path);
      const name = `test-${path.replace(/\W+/g, "-")}`;
      await publish(name, m);
      const r = comparePlanTo3d(planPixels(m), await topView(name));
      expect(r.aspect).toBeCloseTo(1, 2); // undistorted
      expect(r.compared).toBeGreaterThan(100_000);
      expect(r.badTiles, "tiles where the 3D view shows something else than the plan").toEqual([]);
      expect(r.mismatch).toBeLessThan(0.01);
    }, 120_000);
  }

  it("catches a room outline that runs to a wall's centreline (the lobby door gap shows room fill on the plan only)", async () => {
    // Elmstead as first traced: the hallway and lobby both ran to the diagonal lobby screen's
    // centreline, so on the plan the lobby door's gap showed room fill, in 3D a white gap.
    const m = structuredClone(await model("models/elmstead"));
    const storey = m.storeys[0]!;
    const screen = storey.walls.find((w) => w.id === "wall-lobby-screen")!;
    const hallway = storey.rooms.find((r) => r.id === "room-hallway")!;
    const lobby = storey.rooms.find((r) => r.id === "room-lobby")!;
    expect([hallway.outline.length, lobby.outline.length]).toEqual([7, 5]);
    hallway.outline.splice(1, 2, screen.start, screen.end);
    lobby.outline.splice(3, 2, screen.end, screen.start);
    await publish("test-elmstead-centreline", m);
    const r = comparePlanTo3d(planPixels(m), await topView("test-elmstead-centreline"));
    expect(r.badTiles.length).toBeGreaterThan(0);
    // The worst tile covers the screen, which runs from (4.825, 6.575) to (5.45, 6.99) m.
    const [worst] = r.badTiles;
    expect(worst!.x[0]).toBeLessThan(5.45);
    expect(worst!.x[1]).toBeGreaterThan(4.825);
    expect(worst!.y[0]).toBeLessThan(6.99);
    expect(worst!.y[1]).toBeGreaterThan(6.575);
  }, 120_000);
});
