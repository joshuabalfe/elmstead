/**
 * The viewer's click-to-measure tool: snapped picks, the measurement list, Clear/Escape, model
 * changes and the snapshot exemption. Publishes two copies of the cottage so a model change can be
 * exercised without a second building model.
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
import type { BuildingModel } from "../src/schema/schema.js";

declare global {
  interface Window {
    __elmsteadMeasurements?: {
      id: number;
      from: { x: number; y: number; z: number };
      to: { x: number; y: number; z: number };
      values: { straightMm: number; horizontalMm: number; verticalMm: number };
    }[];
  }
}

const VIEWPORT = { width: 1280, height: 900 };
const MODEL_A = "test-measure-a";
const MODEL_B = "test-measure-b";

let outDir: string;
let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let page: Page;
let baseUrl = "";

async function cottage(): Promise<BuildingModel> {
  const r = await loadModel("models/example-cottage");
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("\n"));
  return r.value.model;
}

async function publish(name: string, m: BuildingModel) {
  writeFileSync(join(outDir, `${name}.building.json`), formatJson(m));
  writeFileSync(join(outDir, `${name}.ifc`), await writeIfc(m, { fileName: `${name}.ifc` }));
}

async function waitReady(p: Page) {
  await p.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
  const failed = await p.evaluate(() => window.__elmsteadError);
  if (failed) throw new Error(`viewer failed: ${failed}`);
}

async function openMeasure(p: Page, name = MODEL_A, extra = "") {
  await p.goto(`${baseUrl}?model=${encodeURIComponent(name)}&view=top&labels=0&style=plan&measure=1${extra}`);
  await waitReady(p);
}

const measureCount = (p: Page) => p.evaluate(() => window.__elmsteadMeasurements?.length ?? 0);

async function clickPoints(p: Page) {
  await p.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await p.mouse.click(VIEWPORT.width / 2 + 100, VIEWPORT.height / 2);
  await p.waitForFunction(() => window.__elmsteadMeasurements?.length === 1, null, { timeout: 10_000 });
}

beforeAll(async () => {
  try {
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  } catch (e) {
    if (/Executable doesn't exist|playwright install/i.test(String(e))) throw new Error("Chromium missing — it comes with npm install (@playwright/browser-chromium); if install scripts were skipped, run: npm rebuild @playwright/browser-chromium");
    throw e;
  }
  outDir = mkdtempSync(join(tmpdir(), "elmstead-measure-"));
  process.env.ELMSTEAD_OUT_DIR = outDir;
  const m = await cottage();
  await publish(MODEL_A, m);
  await publish(MODEL_B, m);
  server = await createServer({ configFile: "viewer/vite.config.ts", server: { port: 0 }, logLevel: "error" });
  await server.listen();
  baseUrl = server.resolvedUrls!.local[0]!;
  page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  delete process.env.ELMSTEAD_OUT_DIR;
  if (outDir) rmSync(outDir, { recursive: true, force: true });
}, 60_000);

describe("viewer measurement", () => {
  it("measures two clicked points and reports consistent distances", async () => {
    await openMeasure(page);
    await clickPoints(page);
    const [m] = await page.evaluate(() => window.__elmsteadMeasurements!);
    expect(m).toBeDefined();
    expect(m!.id).toBe(1);
    expect(m!.values.straightMm).toBeGreaterThan(0);
    expect(m!.values.straightMm).toBeCloseTo(Math.hypot(m!.values.horizontalMm, m!.values.verticalMm), 3);
    expect(m!.values.horizontalMm).toBeGreaterThanOrEqual(0);
    expect(m!.values.verticalMm).toBeGreaterThanOrEqual(0);
    const dx = m!.to.x - m!.from.x;
    const dy = m!.to.y - m!.from.y;
    const dz = m!.to.z - m!.from.z;
    const deltas = [dx, dy, dz].filter((v) => Math.abs(v) > 1e-9);
    expect(deltas).toHaveLength(1);
    expect(m!.values.straightMm).toBeCloseTo(Math.abs(deltas[0]!) * 1000, 3);
    expect(await page.locator("#measure-list").isVisible()).toBe(true);
    expect(await page.locator("#measure-list li").textContent()).toMatch(/^M1 \d+ mm · plan \d+ mm · rise \d+ mm$/);
  }, 120_000);

  it("does not measure a drag", async () => {
    await openMeasure(page);
    await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await page.mouse.down();
    await page.mouse.move(VIEWPORT.width / 2 + 120, VIEWPORT.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(await measureCount(page)).toBe(0);
  }, 120_000);

  it("clears a pending point and Escape cancels one", async () => {
    await openMeasure(page);
    const { width, height } = VIEWPORT;
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(200);
    await page.click("#clear");
    await page.mouse.click(width / 2 + 50, height / 2);
    await page.waitForTimeout(500);
    expect(await measureCount(page)).toBe(0);

    await page.click("#clear");
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await page.mouse.click(width / 2 + 50, height / 2);
    await page.waitForTimeout(500);
    expect(await measureCount(page)).toBe(0);

    await page.mouse.click(width / 2 + 100, height / 2);
    await page.waitForFunction(() => window.__elmsteadMeasurements?.length === 1, null, { timeout: 10_000 });
  }, 120_000);

  it("keeps measure mode off and clears measurements when the model changes", async () => {
    await openMeasure(page);
    await clickPoints(page);
    await page.click("#measure");
    expect(await page.getAttribute("#measure", "aria-pressed")).toBe("false");
    await page.selectOption("#model", MODEL_B);
    await page.waitForFunction(() => window.__elmsteadMeasurements?.length === 0);
    expect(await page.getAttribute("#measure", "aria-pressed")).toBe("false");
  }, 120_000);

  it("ignores measure mode and shows no list in a snapshot", async () => {
    await page.goto(`${baseUrl}?model=${encodeURIComponent(MODEL_A)}&view=top&snapshot=1&measure=1&labels=0`);
    await waitReady(page);
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await page.mouse.click(VIEWPORT.width / 2 + 100, VIEWPORT.height / 2);
    await page.waitForTimeout(500);
    expect(await measureCount(page)).toBe(0);
    expect(await page.locator("#bar").isVisible()).toBe(false);
    expect(await page.locator("#measure-hint").isVisible()).toBe(false);
    expect(await page.locator("#measure-list").isVisible()).toBe(false);
  }, 120_000);

  it("starts walk mode, not measure mode, when both URL parameters are present", async () => {
    await page.goto(`${baseUrl}?model=${encodeURIComponent(MODEL_A)}&view=top&walk=1&measure=1`);
    await waitReady(page);
    expect(await page.getAttribute("#measure", "aria-pressed")).toBe("false");
    expect(await page.locator("#walk-hint").isVisible()).toBe(true);
  }, 120_000);

  it("picks a point with a one-finger tap", async () => {
    const context = await browser!.newContext({ viewport: VIEWPORT, hasTouch: true, deviceScaleFactor: 1 });
    const touchPage = await context.newPage();
    try {
      await openMeasure(touchPage);
      await touchPage.touchscreen.tap(VIEWPORT.width / 2, VIEWPORT.height / 2);
      await touchPage.touchscreen.tap(VIEWPORT.width / 2 + 100, VIEWPORT.height / 2);
      await touchPage.waitForFunction(() => window.__elmsteadMeasurements?.length === 1, null, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  }, 120_000);
});