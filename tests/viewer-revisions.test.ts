/**
 * Revisions in the viewer: the revision picker beside the model picker, in-place switching that
 * keeps the view, and the Arrow Left / Right shortcut. Publishes the cottage with two revisions, the
 * two-storey fixture with one, and a model that has only a revision built.
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
import { mm, remove, replace, revise } from "../src/model/index.js";
import type { BuildingModel, Wall } from "../src/schema/schema.js";

declare global {
  interface Window {
    __elmsteadRevisionChanges?: number;
  }
}

const VIEWPORT = { width: 1200, height: 900 };
const COTTAGE = "test-rev-cottage";
const TWO = "test-rev-two";
const ORPHAN = "test-rev-orphan";
const PLAIN = "test-rev-plain";

let outDir: string;
let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let page: Page;
let baseUrl = "";

async function model(path: string): Promise<BuildingModel> {
  const r = await loadModel(path);
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("\n"));
  return r.value.model;
}

async function publish(name: string, m: BuildingModel) {
  writeFileSync(join(outDir, `${name}.building.json`), formatJson(m));
  writeFileSync(join(outDir, `${name}.ifc`), await writeIfc(m, { fileName: `${name}.ifc` }));
}

async function open(query: string) {
  await page.goto(`${baseUrl}?${query}`);
  await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
  const failed = await page.evaluate(() => window.__elmsteadError);
  if (failed) throw new Error(`viewer failed: ${failed}`);
}

/** Two frames, so whatever the last action changed has been drawn. */
const drawn = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

interface Raster {
  width: number;
  height: number;
  data: Buffer;
}

async function canvasPixels(): Promise<Raster> {
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

const samePixels = (a: Raster, b: Raster) => a.width === b.width && a.height === b.height && a.data.equals(b.data);
const changes = () => page.evaluate(() => window.__elmsteadRevisionChanges ?? 0);
const modelParam = () => new URL(page.url()).searchParams.get("model");

/** Wait until the viewer has loaded and drawn the next revision choice after `before`. */
const switched = (before: number) => page.waitForFunction((n: number) => (window.__elmsteadRevisionChanges ?? 0) > n, before, { timeout: 60_000 });

/** Choose a revision in the picker ("" for Existing) and wait until it is drawn. */
async function choose(rev: string) {
  const before = await changes();
  await page.selectOption("#revision", rev);
  await switched(before);
}

/** Press a key and wait until the viewer has drawn the revision it chose. */
async function step(key: string) {
  const before = await changes();
  await page.keyboard.press(key);
  await switched(before);
}

/** Press a key and check that the revision did not change. */
async function ignored(key: string) {
  const [n, m] = [await changes(), modelParam()];
  await page.keyboard.press(key);
  await page.waitForTimeout(500);
  expect(await changes()).toBe(n);
  expect(modelParam()).toBe(m);
}

/** Choose a camera view in the bar and wait until it is drawn. */
async function view(name: string) {
  await page.click(`[data-view="${name}"]`);
  await drawn();
}

const pickerOptions = () =>
  page.$$eval("#revision option", (os) => os.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent, disabled: (o as HTMLOptionElement).disabled })));

beforeAll(async () => {
  try {
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  } catch (e) {
    if (/Executable doesn't exist|playwright install/i.test(String(e))) throw new Error("Chromium missing — it comes with npm install (@playwright/browser-chromium); if install scripts were skipped, run: npm rebuild @playwright/browser-chromium");
    throw e;
  }
  outDir = mkdtempSync(join(tmpdir(), "elmstead-revisions-"));
  process.env.ELMSTEAD_OUT_DIR = outDir;
  const cottage = await model("models/examples/example-cottage");
  await publish(COTTAGE, cottage);
  await publish(`${COTTAGE}@rear-extension`, await model("models/examples/example-cottage/revisions/rear-extension.ts"));
  await publish(`${COTTAGE}@no-kitchen-window`, revise(cottage, [remove("window-kitchen")]));
  const two = await model("tests/fixtures/two-storey");
  await publish(TWO, two);
  // An upper-floor wall moved 1 m east: the revision's storeys are the base's.
  const upper = two.storeys[1]!;
  const moved = upper.walls[0]!;
  const shift = (p: Wall["start"]) => ({ x: mm(p.x + 1000), y: p.y });
  await publish(`${TWO}@moved`, revise(two, [replace({ ...moved, start: shift(moved.start), end: shift(moved.end) })]));
  await publish(`${ORPHAN}@only`, cottage);
  await publish(PLAIN, cottage);
  server = await createServer({ configFile: "viewer/vite.config.ts", server: { port: 0 }, logLevel: "error" });
  await server.listen();
  baseUrl = server.resolvedUrls!.local[0]!;
  page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  delete process.env.ELMSTEAD_OUT_DIR;
  if (outDir) rmSync(outDir, { recursive: true, force: true });
}, 60_000);

describe("revision picker", () => {
  it("lists each model once and its revisions under Existing, as text", async () => {
    await open(`model=${COTTAGE}&view=top&labels=0`);
    const models = await page.$$eval("#model option", (os) => os.map((o) => o.textContent));
    expect(models).toEqual([COTTAGE, ORPHAN, PLAIN, TWO]);
    expect(await page.isHidden("#revision")).toBe(false);
    expect(await pickerOptions()).toEqual([
      { value: "", text: "Existing", disabled: false },
      { value: "no-kitchen-window", text: "no-kitchen-window", disabled: false },
      { value: "rear-extension", text: "rear-extension", disabled: false },
    ]);
    expect(await page.inputValue("#revision")).toBe("");
    expect(await page.getAttribute("#revision", "title")).toContain("Left / Right");
  }, 120_000);

  it("writes the choice to ?model= and back", async () => {
    await open(`model=${COTTAGE}&view=top&labels=0`);
    await choose("rear-extension");
    expect(modelParam()).toBe(`${COTTAGE}@rear-extension`);
    expect(await page.textContent("#status")).toContain(`${COTTAGE}@rear-extension.ifc`);
    await choose("");
    expect(modelParam()).toBe(COTTAGE);
  }, 120_000);

  it("opens a shared revision link with both pickers set", async () => {
    await open(`model=${encodeURIComponent(`${COTTAGE}@rear-extension`)}&view=top&labels=0`);
    expect(await page.inputValue("#model")).toBe(COTTAGE);
    expect(await page.inputValue("#revision")).toBe("rear-extension");
    expect(await page.textContent("#status")).toContain(`${COTTAGE}@rear-extension.ifc`);
  }, 120_000);

  it("is hidden for a model without revisions, and shown again for one with them", async () => {
    await open(`model=${COTTAGE}&view=top&labels=0`);
    await page.selectOption("#model", PLAIN);
    await page.waitForFunction((m: string) => document.querySelector("#status")?.textContent?.startsWith(`${m}.ifc`), PLAIN, { timeout: 60_000 });
    expect(await page.isHidden("#revision")).toBe(true);
    expect(modelParam()).toBe(PLAIN);
    await ignored("ArrowRight");
    await page.selectOption("#model", COTTAGE);
    await page.waitForFunction((m: string) => document.querySelector("#status")?.textContent?.startsWith(`${m}.ifc`), COTTAGE, { timeout: 60_000 });
    expect(await page.isHidden("#revision")).toBe(false);
    expect(await page.inputValue("#revision")).toBe("");
  }, 120_000);

  it("opens a model with only revisions built on its first revision, with Existing disabled", async () => {
    await open(`model=${ORPHAN}&view=top&labels=0`);
    expect(modelParam()).toBe(`${ORPHAN}@only`);
    expect(await pickerOptions()).toEqual([
      { value: "", text: "Existing", disabled: true },
      { value: "only", text: "only", disabled: false },
    ]);
  }, 120_000);
});

describe("switching revisions keeps the view", () => {
  it("keeps a view chosen after opening, not the URL's ?view=", async () => {
    await open(`model=${COTTAGE}&view=sw&labels=0`);
    await view("top");
    const top = await canvasPixels();
    await choose("rear-extension");
    expect(samePixels(await canvasPixels(), top)).toBe(false); // the revision is drawn
    await choose("");
    // Back on the base: a re-frame to the URL's south-west view would not give the same picture.
    expect(samePixels(await canvasPixels(), top)).toBe(true);
  }, 180_000);

  it("draws only the old revision and then the new one, with nothing in between", async () => {
    await open(`model=${COTTAGE}&view=nw&labels=0`);
    await drawn();
    // Fingerprint every animation frame of the switch on a small copy of the canvas. A string, so
    // the bundler's helpers stay out of the page.
    await page.evaluate(`(() => {
      const gl = document.querySelector("#container canvas");
      const c = document.createElement("canvas");
      c.width = 120;
      c.height = 80;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      window.__frames = [];
      window.__sampling = true;
      const tick = () => {
        ctx.clearRect(0, 0, 120, 80);
        ctx.drawImage(gl, 0, 0, 120, 80);
        const d = ctx.getImageData(0, 0, 120, 80).data;
        let h = 0;
        for (let i = 0; i < d.length; i++) h = (Math.imul(h, 31) + d[i]) | 0;
        window.__frames.push(h);
        if (window.__sampling) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })()`);
    await drawn();
    await step("ArrowRight");
    await page.waitForTimeout(300);
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __sampling: boolean; __frames: number[] };
      w.__sampling = false;
      return w.__frames;
    });
    const distinct = frames.filter((f, i) => i === 0 || f !== frames[i - 1]);
    // A blank frame while the revision converts, or a half-styled one while its plan style and
    // overlays are applied, would show up as a third picture.
    expect(distinct).toHaveLength(2);
    expect(frames[0]).toBe(distinct[0]);
  }, 120_000);

  it("does not re-apply ?camera= after the camera has moved", async () => {
    await open(`model=${COTTAGE}&view=top&labels=0&camera=16,11,6,5.2,1.5,-4.2`);
    const fromUrl = await canvasPixels();
    await view("nw");
    const moved = await canvasPixels();
    expect(samePixels(moved, fromUrl)).toBe(false);
    await choose("rear-extension");
    await choose("");
    expect(samePixels(await canvasPixels(), moved)).toBe(true);
  }, 180_000);

  it("frames the revision's own extent when a view button is chosen after switching", async () => {
    await open(`model=${encodeURIComponent(`${COTTAGE}@rear-extension`)}&view=top&labels=0`);
    const direct = await canvasPixels();
    await open(`model=${COTTAGE}&view=top&labels=0`);
    await choose("rear-extension");
    await view("top");
    expect(samePixels(await canvasPixels(), direct)).toBe(true);
  }, 180_000);

  it("carries the shown storeys and the Ids toggle over", async () => {
    await open(`model=${TWO}&view=top&labels=0&storeys=storey-ground`);
    await page.click("#ids");
    await choose("moved");
    expect(new URL(page.url()).searchParams.get("storeys")).toBe("storey-ground");
    expect(await page.inputValue("#storeys")).toBe("storey-ground");
    expect(await page.getAttribute("#ids", "aria-pressed")).toBe("true");
  }, 120_000);

  it("clears measurements, which belong to the old geometry", async () => {
    await open(`model=${COTTAGE}&view=top&labels=0&style=plan&measure=1`);
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await page.mouse.click(VIEWPORT.width / 2 + 100, VIEWPORT.height / 2);
    await page.waitForFunction(() => (window as { __elmsteadMeasurements?: unknown[] }).__elmsteadMeasurements?.length === 1, null, { timeout: 10_000 });
    await choose("rear-extension");
    expect(await page.evaluate(() => (window as { __elmsteadMeasurements?: unknown[] }).__elmsteadMeasurements?.length ?? 0)).toBe(0);
  }, 120_000);

  it("leaves walk mode", async () => {
    await open(`model=${COTTAGE}&view=top&labels=0&walk=1`);
    expect(await page.getAttribute("#walk", "aria-pressed")).toBe("true");
    await choose("rear-extension");
    expect(await page.getAttribute("#walk", "aria-pressed")).toBe("false");
    expect(modelParam()).toBe(`${COTTAGE}@rear-extension`);
  }, 120_000);
});

describe("revisions stay loaded", () => {
  /** The IFC files the page fetches from now on, by name. */
  function ifcFetches(): string[] {
    const names: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith(".ifc")) names.push(decodeURIComponent(r.url().split("/out/")[1]!).replace(/\.ifc$/, ""));
    });
    return names;
  }

  it("shows a revision seen before without fetching or converting it again", async () => {
    await open(`model=${COTTAGE}&view=nw&labels=0`);
    const fetched = ifcFetches();
    await step("ArrowRight");
    await step("ArrowRight");
    await step("ArrowLeft");
    await step("ArrowLeft");
    expect(fetched).toEqual([`${COTTAGE}@no-kitchen-window`, `${COTTAGE}@rear-extension`]);
  }, 180_000);

  it("draws a kept revision exactly as a fresh load, stairs included", async () => {
    await open(`model=${TWO}&view=nw&labels=0`);
    const existing = await canvasPixels();
    await choose("moved");
    const moved = await canvasPixels();
    await choose("");
    expect(samePixels(await canvasPixels(), existing)).toBe(true);
    await choose("moved");
    expect(samePixels(await canvasPixels(), moved)).toBe(true);
  }, 180_000);

  it("lets another model's revisions go when the model changes", async () => {
    await open(`model=${COTTAGE}&view=nw&labels=0`);
    await choose("rear-extension");
    const fetched = ifcFetches();
    await page.selectOption("#model", PLAIN);
    await page.waitForFunction((m: string) => document.querySelector("#status")?.textContent?.startsWith(`${m}.ifc`), PLAIN, { timeout: 60_000 });
    await page.selectOption("#model", COTTAGE);
    await page.waitForFunction((m: string) => document.querySelector("#status")?.textContent?.startsWith(`${m}.ifc`), COTTAGE, { timeout: 60_000 });
    await choose("rear-extension");
    expect(fetched).toEqual([PLAIN, COTTAGE, `${COTTAGE}@rear-extension`]);
  }, 180_000);
});

describe("revision keyboard shortcut", () => {
  it("steps right and left through the picker without wrapping, keeping the view", async () => {
    await open(`model=${COTTAGE}&view=top&labels=0`);
    const existing = await canvasPixels();
    await ignored("ArrowLeft");
    await step("ArrowRight");
    expect(await page.inputValue("#revision")).toBe("no-kitchen-window");
    await step("ArrowRight");
    expect(modelParam()).toBe(`${COTTAGE}@rear-extension`);
    await ignored("ArrowRight");
    await step("ArrowLeft");
    await step("ArrowLeft");
    expect(modelParam()).toBe(COTTAGE);
    expect(samePixels(await canvasPixels(), existing)).toBe(true);
  }, 180_000);

  it("skips a disabled Existing", async () => {
    await open(`model=${ORPHAN}&view=top&labels=0`);
    await ignored("ArrowLeft");
    expect(modelParam()).toBe(`${ORPHAN}@only`);
  }, 120_000);

  it("steps the revision, not the storey, when the storey selector has focus", async () => {
    await open(`model=${TWO}&view=top&labels=0&storeys=storey-ground`);
    await page.focus("#storeys");
    await step("ArrowRight");
    expect(modelParam()).toBe(`${TWO}@moved`);
    expect(await page.inputValue("#storeys")).toBe("storey-ground");
    expect(new URL(page.url()).searchParams.get("storeys")).toBe("storey-ground");
  }, 120_000);

  it("is ignored with a modifier held and in walk mode", async () => {
    await open(`model=${COTTAGE}&view=top&labels=0`);
    await ignored("Shift+ArrowRight");
    await open(`model=${COTTAGE}&view=top&labels=0&walk=1`);
    await ignored("ArrowRight");
  }, 120_000);
});
