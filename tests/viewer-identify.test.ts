/**
 * The viewer's hover identification: the Ids toggle, label content, drag/view/walk/storey
 * composition, the URL lifecycle, room-id labels and the snapshot exemption. Publishes two copies
 * of the cottage so a model change can be exercised, plus the two-storey model for hidden storeys.
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
    __elmsteadHover?: { id: string; name: string | null } | null;
    __elmsteadRoomLabels?: string[][];
    __elmsteadStoreyChanges?: number;
  }
}

const VIEWPORT = { width: 1280, height: 900 };
const MODEL_A = "test-identify-a";
const MODEL_B = "test-identify-b";
const MODEL_TWO = "test-identify-two";

let outDir: string;
let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let page: Page;
let baseUrl = "";
let cottageModel: BuildingModel;
let twoModel: BuildingModel;

async function publish(name: string, m: BuildingModel) {
  writeFileSync(join(outDir, `${name}.building.json`), formatJson(m));
  writeFileSync(join(outDir, `${name}.ifc`), await writeIfc(m, { fileName: `${name}.ifc` }));
}

async function waitReady(p: Page) {
  await p.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
  const failed = await p.evaluate(() => window.__elmsteadError);
  if (failed) throw new Error(`viewer failed: ${failed}`);
}

async function open(p: Page, name = MODEL_A, extra = "") {
  await p.goto(`${baseUrl}?model=${encodeURIComponent(name)}&view=top&labels=0&style=plan${extra}`);
  await waitReady(p);
}

const hover = (p: Page) => p.evaluate(() => window.__elmsteadHover ?? null);
// The label is a scene sprite, so the hook is the handle for shown/hidden.
const tipVisible = (p: Page) => p.evaluate(() => window.__elmsteadHover !== null);

/** Park the pointer off the model (bottom-left, clear of the bar and compass) and wait for null. */
async function hoverOff(p: Page) {
  await p.mouse.move(4, VIEWPORT.height - 4);
  await p.waitForFunction(() => window.__elmsteadHover === null, null, { timeout: 5000 });
}

/** Hover a point from a known-null state so the wait observes a real transition. */
async function hoverAt(p: Page, x: number, y: number) {
  await hoverOff(p);
  await p.mouse.move(x, y);
  await p.waitForFunction(() => window.__elmsteadHover !== null, null, { timeout: 5000 });
  return hover(p);
}

const centre = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

beforeAll(async () => {
  try {
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  } catch (e) {
    if (/Executable doesn't exist|playwright install/i.test(String(e))) throw new Error("Chromium missing — it comes with npm install (@playwright/browser-chromium); if install scripts were skipped, run: npm rebuild @playwright/browser-chromium");
    throw e;
  }
  outDir = mkdtempSync(join(tmpdir(), "elmstead-identify-"));
  process.env.ELMSTEAD_OUT_DIR = outDir;
  const cottage = await loadModel("models/example-cottage");
  if (!cottage.ok) throw new Error(cottage.issues.map((i) => i.message).join("\n"));
  cottageModel = cottage.value.model;
  const two = await loadModel("models/example-two-storey");
  if (!two.ok) throw new Error(two.issues.map((i) => i.message).join("\n"));
  twoModel = two.value.model;
  await publish(MODEL_A, cottageModel);
  await publish(MODEL_B, cottageModel);
  await publish(MODEL_TWO, twoModel);
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

describe("viewer hover identification", () => {
  it("starts off, toggles with the Ids button and names the hovered element", async () => {
    await open(page);
    expect(await page.locator("#ids").getAttribute("aria-pressed")).toBe("false");
    await page.mouse.move(centre.x, centre.y);
    await page.waitForTimeout(400);
    expect(await hover(page)).toBeNull();
    await page.click("#ids");
    expect(await page.locator("#ids").getAttribute("aria-pressed")).toBe("true");
    const h = await hoverAt(page, centre.x, centre.y);
    expect(h).toEqual({ id: "slab-ground", name: "Ground floor slab" });
    expect(await tipVisible(page)).toBe(true);
    await page.click("#ids");
    expect(await page.locator("#ids").getAttribute("aria-pressed")).toBe("false");
    expect(await tipVisible(page)).toBe(false);
    expect(await hover(page)).toBeNull();
  }, 120_000);

  it("starts on with ?ids=1 and hides off the model", async () => {
    await open(page, MODEL_A, "&ids=1");
    expect(await page.locator("#ids").getAttribute("aria-pressed")).toBe("true");
    expect(await hoverAt(page, centre.x, centre.y)).toEqual({ id: "slab-ground", name: "Ground floor slab" });
    await hoverOff(page);
    expect(await tipVisible(page)).toBe(false);
  }, 120_000);

  it("updates as the pointer moves between elements", async () => {
    await open(page, MODEL_A, "&ids=1");
    // Walls are ~20 px wide on screen, so scan a fine line across the hall's north-south walls.
    const ids = new Set<string>();
    for (let x = Math.round(VIEWPORT.width * 0.2); x <= VIEWPORT.width * 0.8; x += 6) {
      await page.mouse.move(x, VIEWPORT.height / 2);
      await page.waitForTimeout(25);
      const h = await hover(page);
      if (h) ids.add(h.id);
    }
    expect(ids.has("slab-ground")).toBe(true);
    expect([...ids].some((id) => id.startsWith("wall-"))).toBe(true);
  }, 120_000);

  it("hides the label while dragging and restores it after", async () => {
    await open(page, MODEL_A, "&ids=1");
    await hoverAt(page, centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 100, centre.y, { steps: 4 });
    expect(await tipVisible(page)).toBe(false);
    expect(await hover(page)).toBeNull();
    await page.mouse.up();
    expect(await hoverAt(page, centre.x, centre.y)).toEqual({ id: "slab-ground", name: "Ground floor slab" });
  }, 120_000);

  it("hides the label while the view changes and re-identifies once it settles", async () => {
    await open(page, MODEL_A, "&ids=1");
    await hoverAt(page, centre.x, centre.y);
    await page.click('[data-view="ne"]');
    await page.waitForFunction(() => window.__elmsteadHover === null, null, { timeout: 5000 });
    expect(await tipVisible(page)).toBe(false);
    await page.waitForFunction(() => window.__elmsteadHover !== null, null, { timeout: 10_000 });
  }, 120_000);

  it("still measures with Ids on", async () => {
    await open(page, MODEL_A, "&ids=1&measure=1");
    await page.mouse.click(centre.x, centre.y);
    await page.mouse.click(centre.x + 100, centre.y);
    await page.waitForFunction(() => window.__elmsteadMeasurements?.length === 1, null, { timeout: 10_000 });
  }, 120_000);

  it("never names a hidden storey's elements", async () => {
    await open(page, MODEL_TWO, "&ids=1");
    const upper = twoModel.storeys[1]!;
    const upperIds = new Set([
      ...upper.walls.map((w) => w.id),
      ...upper.openings.map((o) => o.id),
      ...upper.slabs.map((s) => s.id),
      ...upper.rooms.map((r) => r.id),
    ]);
    await page.selectOption("#storeys", twoModel.storeys[0]!.id);
    await page.waitForFunction(() => (window.__elmsteadStoreyChanges ?? 0) >= 1, null, { timeout: 10_000 });
    for (const fy of [0.4, 0.5, 0.6]) {
      for (const fx of [0.4, 0.5, 0.6]) {
        const h = await hoverAt(page, VIEWPORT.width * fx, VIEWPORT.height * fy);
        if (h) expect(upperIds.has(h.id)).toBe(false);
      }
    }
  }, 120_000);

  it("shows no label while walking, even with the mouse moving, and restores after", async () => {
    await open(page, MODEL_A, "&ids=1&walk=1");
    expect(await page.locator("#walk").getAttribute("aria-pressed")).toBe("true");
    for (const fx of [0.4, 0.5, 0.6]) {
      await page.mouse.move(VIEWPORT.width * fx, VIEWPORT.height * 0.5);
      await page.waitForTimeout(200);
      expect(await hover(page)).toBeNull();
      expect(await tipVisible(page)).toBe(false);
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__elmsteadReady === true, null, { timeout: 10_000 });
    expect(await hoverAt(page, centre.x, centre.y)).toEqual({ id: "slab-ground", name: "Ground floor slab" });
  }, 120_000);

  it("hides the label on a model change and keeps the toggle on", async () => {
    await open(page, MODEL_A, "&ids=1");
    await hoverAt(page, centre.x, centre.y);
    await page.selectOption("#model", MODEL_B);
    await waitReady(page);
    expect(await hover(page)).toBeNull();
    expect(await tipVisible(page)).toBe(false);
    expect(await page.locator("#ids").getAttribute("aria-pressed")).toBe("true");
    expect(await hoverAt(page, centre.x, centre.y)).toEqual({ id: "slab-ground", name: "Ground floor slab" });
  }, 120_000);

  it("does not re-apply ?ids=1 after a model change", async () => {
    await open(page, MODEL_A, "&ids=1");
    await page.click("#ids");
    await page.selectOption("#model", MODEL_B);
    await waitReady(page);
    expect(await page.locator("#ids").getAttribute("aria-pressed")).toBe("false");
    await page.mouse.move(centre.x, centre.y);
    await page.waitForTimeout(400);
    expect(await hover(page)).toBeNull();
  }, 120_000);

  it("includes the room id in each room label", async () => {
    await page.goto(`${baseUrl}?model=${MODEL_A}&view=top&labels=1&style=plan`);
    await waitReady(page);
    const labels = await page.evaluate(() => window.__elmsteadRoomLabels ?? []);
    const living = cottageModel.storeys[0]!.rooms.find((r) => r.id === "room-living")!;
    const row = labels.find((l) => l[2] === "room-living");
    expect(row).toBeDefined();
    expect(row![0]).toBe(living.name);
    expect(labels.length).toBe(cottageModel.storeys[0]!.rooms.length);
  }, 120_000);

  it("ignores Ids in snapshots", async () => {
    await page.goto(`${baseUrl}?model=${MODEL_A}&view=top&snapshot=1&ids=1`);
    await waitReady(page);
    expect(await page.locator("#ids").isHidden()).toBe(true);
    await page.mouse.move(centre.x, centre.y);
    await page.waitForTimeout(400);
    expect(await hover(page)).toBeNull();
    expect(await tipVisible(page)).toBe(false);
  }, 120_000);
});