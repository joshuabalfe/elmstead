/**
 * What the viewer tests share: Chromium (software WebGL), the viewer served from a temporary
 * out/ folder, one page, and helpers to publish a model and read the WebGL canvas back as pixels.
 * Call useViewer() once at the top of a test file.
 *
 * Chromium comes with npm install (@playwright/browser-chromium, pinned to playwright's version).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll } from "vitest";
import { formatJson } from "../../src/cli/json-format.js";
import { loadModel } from "../../src/cli/load.js";
import { writeIfc } from "../../src/ifc/writer.js";
import type { BuildingModel } from "../../src/schema/schema.js";
import type { Raster } from "./plan-vs-3d.js";

declare global {
  interface Window {
    __elmsteadStoreyChanges?: number;
  }
}

export const VIEWPORT = { width: 1600, height: 1200 };

export let outDir: string;
export let server: ViteDevServer | undefined;
export let browser: Browser | undefined;
export let page: Page;

export async function model(path: string): Promise<BuildingModel> {
  const r = await loadModel(path);
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("\n"));
  return r.value.model;
}

/** Write the model where the viewer reads it, as `build` would. */
export async function publish(name: string, m: BuildingModel) {
  writeFileSync(join(outDir, `${name}.building.json`), formatJson(m));
  writeFileSync(join(outDir, `${name}.ifc`), await writeIfc(m, { fileName: `${name}.ifc` }));
}

/** The viewer's canvas as raw pixels. */
export async function canvasPixels(): Promise<Raster> {
  const { width, height, b64 } = await page.evaluate(async () => {
    const gl = document.querySelector<HTMLCanvasElement>("#container canvas")!;
    const c = document.createElement("canvas");
    [c.width, c.height] = [gl.width, gl.height];
    const ctx = c.getContext("2d")!;
    ctx.drawImage(gl, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    // A FileReader's data URL is base64 made natively: about twice as fast as building the string
    // by hand from 7.7 MB of pixels.
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(new Blob([d]));
    });
    return { width: c.width, height: c.height, b64: url.slice(url.indexOf(",") + 1) };
  });
  return { width, height, data: new Uint8Array(Buffer.from(b64, "base64")) };
}

/** The viewer's canvas as raw pixels, for any query string. */
export async function viewOf(name: string, query: string): Promise<Raster> {
  const url = server!.resolvedUrls!.local[0]!;
  await page.goto(`${url}?model=${encodeURIComponent(name)}&${query}`);
  await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
  const failed = await page.evaluate(() => window.__elmsteadError);
  if (failed) throw new Error(`viewer failed: ${failed}`);
  return canvasPixels();
}

export const samePixels = (a: Raster, b: Raster) => a.width === b.width && a.height === b.height && Buffer.from(a.data).equals(Buffer.from(b.data));

/** Choose a floor in the bar and wait until the viewer has applied and drawn it. */
export async function selectStorey(id: string) {
  const before = await page.evaluate(() => window.__elmsteadStoreyChanges ?? 0);
  await page.selectOption("#storeys", id);
  await page.waitForFunction((n: number) => (window.__elmsteadStoreyChanges ?? 0) > n, before, { timeout: 60_000 });
}

/** The viewer's Top view in plan style, labels off, as raw pixels from its WebGL canvas. */
export async function topView(name: string, storeyId?: string): Promise<Raster> {
  const storeys = storeyId ? `&storeys=${encodeURIComponent(storeyId)}` : "";
  return viewOf(name, `view=top&snapshot=1&labels=0&style=plan${storeys}`);
}

/** How many pixels are within `tol` of `rgb` on every channel. */
export const near = (r: Raster, rgb: [number, number, number], tol: number): number => {
  let n = 0;
  for (let i = 0; i < r.data.length; i += 4) {
    if (Math.abs(r.data[i]! - rgb[0]) <= tol && Math.abs(r.data[i + 1]! - rgb[1]) <= tol && Math.abs(r.data[i + 2]! - rgb[2]) <= tol) n++;
  }
  return n;
};

/** Starts Chromium, the viewer's server and one page for this test file; closes them after. */
export function useViewer() {
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
}
