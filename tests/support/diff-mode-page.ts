/**
 * What the Diff mode viewer tests share: Chromium (software WebGL), the viewer served from a
 * temporary out/ folder holding the cottage with its revisions, the two-storey fixture and
 * Elmstead, one page, and helpers to open a view and read the canvas back as pixels. Call
 * useDiffMode() once at the top of a test file.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll } from "vitest";
import { formatJson } from "../../src/backend/cli/json-format.js";
import { loadModel } from "../../src/backend/cli/load.js";
import { writeIfc } from "../../src/backend/ifc/writer.js";
import { addTo, mm, pt, remove, revise, wall } from "../../src/backend/model/index.js";
import type { BuildingModel } from "../../src/shared/schema/schema.js";

declare global {
  interface Window {
    __elmsteadViewChanges?: number;
    __elmsteadRevisionChanges?: number;
    __elmsteadDiff?: Record<"added" | "changed" | "removed", string[]> | null;
    __elmsteadOutlines?: Record<"added" | "changed" | "removed", number>;
    __elmsteadGhosts?: string[];
  }
}

export const VIEWPORT = { width: 1200, height: 900 };
export const COTTAGE = "test-dm-cottage";
export const TWO = "test-dm-two";
export const NOBASE = "test-dm-nobase";
export const ELM = "test-dm-elmstead";

export let outDir: string;
export let server: ViteDevServer | undefined;
export let browser: Browser | undefined;
export let page: Page;
export let baseUrl = "";

export async function model(path: string): Promise<BuildingModel> {
  const r = await loadModel(path);
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("\\n"));
  return r.value.model;
}

export async function publish(name: string, m: BuildingModel, { ifc = true } = {}) {
  writeFileSync(join(outDir, `${name}.building.json`), formatJson(m));
  if (ifc) writeFileSync(join(outDir, `${name}.ifc`), await writeIfc(m, { fileName: `${name}.ifc` }));
}

export async function open(query: string) {
  await page.goto(`${baseUrl}?labels=0&${query}`);
  await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
  const failed = await page.evaluate(() => window.__elmsteadError);
  if (failed) throw new Error(`viewer failed: ${failed}`);
  await drawn();
}

export const drawn = () =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
export const viewChanges = () => page.evaluate(() => window.__elmsteadViewChanges ?? 0);

/** Run a view change (a click or a key) and wait until it has been applied and drawn. */
export async function viewChange(act: () => Promise<unknown>) {
  const before = await viewChanges();
  await act();
  await page.waitForFunction((n: number) => (window.__elmsteadViewChanges ?? 0) > n, before, { timeout: 60_000 });
  await drawn();
}

export async function chooseRevision(rev: string) {
  const before = await page.evaluate(() => window.__elmsteadRevisionChanges ?? 0);
  await page.selectOption("#revision", rev);
  await page.waitForFunction((n: number) => (window.__elmsteadRevisionChanges ?? 0) > n, before, { timeout: 60_000 });
  await drawn();
}

export interface Raster {
  width: number;
  height: number;
  data: Buffer;
}

export async function pixels(): Promise<Raster> {
  await drawn();
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
  return { width, height, data: Buffer.from(b64, "base64") };
}

export const same = (a: Raster, b: Raster) => a.width === b.width && a.height === b.height && a.data.equals(b.data);

/** How many pixels pass a colour test, with their bounding box. */
export function count(r: Raster, test: (red: number, green: number, blue: number) => boolean) {
  let n = 0;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < r.data.length; i += 4) {
    if (!test(r.data[i]!, r.data[i + 1]!, r.data[i + 2]!)) continue;
    n++;
    const p = i / 4;
    const [x, y] = [p % r.width, Math.floor(p / r.width)];
    [box.x0, box.y0, box.x1, box.y1] = [
      Math.min(box.x0, x),
      Math.min(box.y0, y),
      Math.max(box.x1, x),
      Math.max(box.y1, y),
    ];
  }
  return { n, box };
}

/** Diff's pale green fill, however lit, and its dark green accent. Nothing else in these models is green. */
export const greenish = (r: number, g: number, b: number) => g - r > 35 && g - b > 20;
export const darkGreen = (r: number, g: number, b: number) => g > 90 && g < 150 && r < 60 && b < 80;
/** Any green at all, however faint: a faded stair in the IFC's safe green over a pale background. */
export const faintGreen = (r: number, g: number, b: number) => g - r > 8 && g - b > 10;
/** The floor tints, GitHub's subtle line backgrounds: `#fff8c5` changed, `#e6ffec` added. Not the cream floor. */
export const changedFloor = (r: number, g: number, b: number) => r > 248 && g > 238 && b > 180 && b < 212;
export const addedFloor = (r: number, g: number, b: number) => g > 248 && g - r > 15 && g - b > 10;

/** Record every frame drawn while `act` runs, as small fingerprints, and return how many distinct pictures there were. */
export async function picturesDuring(act: () => Promise<unknown>): Promise<number> {
  await page.evaluate(`(() => {
    const gl = document.querySelector("#container canvas");
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 90;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    window.__frames = [];
    window.__sampling = true;
    const tick = () => {
      ctx.clearRect(0, 0, 120, 90);
      ctx.drawImage(gl, 0, 0, 120, 90);
      const d = ctx.getImageData(0, 0, 120, 90).data;
      let h = 0;
      for (let i = 0; i < d.length; i++) h = (Math.imul(h, 31) + d[i]) | 0;
      window.__frames.push(h);
      if (window.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
  await drawn();
  await act();
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __sampling: boolean; __frames: number[] };
    w.__sampling = false;
    return w.__frames;
  });
  return frames.filter((f, i) => i === 0 || f !== frames[i - 1]).length;
}

/** Sweep the pointer over the canvas until the hover label reports `status`; the point, or null. */
export async function findHover(status: string): Promise<{ x: number; y: number } | null> {
  for (let y = 120; y < VIEWPORT.height - 60; y += 25) {
    for (let x = 120; x < VIEWPORT.width - 300; x += 25) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(30);
      const h = await page.evaluate(
        () => (window as unknown as { __elmsteadHover?: { status?: string } | null }).__elmsteadHover ?? null,
      );
      if (h?.status === status) return { x, y };
    }
  }
  return null;
}

/** Starts Chromium, the viewer's server and one page, with the models these tests open published; closes them after. */
export function useDiffMode() {
  beforeAll(async () => {
    try {
      browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    } catch (e) {
      if (/Executable doesn't exist|playwright install/i.test(String(e)))
        throw new Error(
          "Chromium missing — it comes with npm install (@playwright/browser-chromium); if install scripts were skipped, run: npm rebuild @playwright/browser-chromium",
        );
      throw e;
    }
    outDir = mkdtempSync(join(tmpdir(), "elmstead-diff-mode-"));
    process.env.ELMSTEAD_OUT_DIR = outDir;
    const cottage = await model("models/examples/example-cottage");
    await publish(COTTAGE, cottage);
    await publish(
      `${COTTAGE}@rear-extension`,
      await model("models/examples/example-cottage/revisions/rear-extension.ts"),
    );
    await publish(`${COTTAGE}@no-kitchen-window`, revise(cottage, [remove("window-kitchen")]));
    // The two-storey fixture: an upper-floor wall removed, a ground-floor wall added.
    const two = await model("tests/fixtures/two-storey");
    await publish(TWO, two);
    const upperWall = two.storeys[1]!.walls.find((w) => !two.storeys[1]!.openings.some((o) => o.wallId === w.id))!;
    const shed = wall("wall-shed", pt(mm(-2000), mm(0)), pt(mm(-2000), mm(2000)), {
      thickness: mm(200),
      height: mm(2400),
    });
    await publish(
      `${TWO}@both-floors`,
      revise(two, [remove(upperWall.id), addTo(two.storeys[0]!.id, { walls: [shed] })]),
    );
    await publish(ELM, await model("models/elmstead")); // stairs, for Transparency's stair presentation
    // A base with its JSON but no IFC, and a revision of it.
    await publish(NOBASE, cottage, { ifc: false });
    await publish(
      `${NOBASE}@rear-extension`,
      await model("models/examples/example-cottage/revisions/rear-extension.ts"),
    );
    server = await createServer({
      configFile: "src/frontend/vite/vite.config.ts",
      server: { port: 0 },
      logLevel: "error",
    });
    await server.listen();
    baseUrl = server.resolvedUrls!.local[0]!;
    page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
    delete process.env.ELMSTEAD_OUT_DIR;
    if (outDir) rmSync(outDir, { recursive: true, force: true });
  }, 60_000);
}

export const REV = `model=${encodeURIComponent(`${COTTAGE}@rear-extension`)}`;
export const diffParam = () => new URL(page.url()).searchParams.get("diff");
export const xrayParam = () => new URL(page.url()).searchParams.get("xray");
