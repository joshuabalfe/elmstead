/**
 * Diff mode and Transparency in the viewer: the toggles, the colours and outlines, the plan drawing,
 * the removed elements' ghosts, the changes panel, hover status and drawing in one picture. Publishes
 * the cottage with its rear extension and a second revision, the two-storey fixture with a revision
 * that changes both floors, and a revision whose base has JSON but no IFC.
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
import { addTo, mm, pt, remove, revise, wall } from "../src/model/index.js";
import type { BuildingModel } from "../src/schema/schema.js";

declare global {
  interface Window {
    __elmsteadViewChanges?: number;
    __elmsteadRevisionChanges?: number;
    __elmsteadDiff?: Record<"added" | "changed" | "removed", string[]> | null;
    __elmsteadOutlines?: Record<"added" | "changed" | "removed", number>;
    __elmsteadGhosts?: string[];
  }
}

const VIEWPORT = { width: 1200, height: 900 };
const COTTAGE = "test-dm-cottage";
const TWO = "test-dm-two";
const NOBASE = "test-dm-nobase";

let outDir: string;
let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let page: Page;
let baseUrl = "";

async function model(path: string): Promise<BuildingModel> {
  const r = await loadModel(path);
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("\\n"));
  return r.value.model;
}

async function publish(name: string, m: BuildingModel, { ifc = true } = {}) {
  writeFileSync(join(outDir, `${name}.building.json`), formatJson(m));
  if (ifc) writeFileSync(join(outDir, `${name}.ifc`), await writeIfc(m, { fileName: `${name}.ifc` }));
}

async function open(query: string) {
  await page.goto(`${baseUrl}?labels=0&${query}`);
  await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
  const failed = await page.evaluate(() => window.__elmsteadError);
  if (failed) throw new Error(`viewer failed: ${failed}`);
  await drawn();
}

const drawn = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const viewChanges = () => page.evaluate(() => window.__elmsteadViewChanges ?? 0);

/** Run a view change (a click or a key) and wait until it has been applied and drawn. */
async function viewChange(act: () => Promise<unknown>) {
  const before = await viewChanges();
  await act();
  await page.waitForFunction((n: number) => (window.__elmsteadViewChanges ?? 0) > n, before, { timeout: 60_000 });
  await drawn();
}

async function chooseRevision(rev: string) {
  const before = await page.evaluate(() => window.__elmsteadRevisionChanges ?? 0);
  await page.selectOption("#revision", rev);
  await page.waitForFunction((n: number) => (window.__elmsteadRevisionChanges ?? 0) > n, before, { timeout: 60_000 });
  await drawn();
}

interface Raster {
  width: number;
  height: number;
  data: Buffer;
}

async function pixels(): Promise<Raster> {
  await drawn();
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
  return { width, height, data: Buffer.from(b64, "base64") };
}

const same = (a: Raster, b: Raster) => a.width === b.width && a.height === b.height && a.data.equals(b.data);

/** How many pixels pass a colour test, with their bounding box. */
function count(r: Raster, test: (red: number, green: number, blue: number) => boolean) {
  let n = 0;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < r.data.length; i += 4) {
    if (!test(r.data[i]!, r.data[i + 1]!, r.data[i + 2]!)) continue;
    n++;
    const p = i / 4;
    const [x, y] = [p % r.width, Math.floor(p / r.width)];
    [box.x0, box.y0, box.x1, box.y1] = [Math.min(box.x0, x), Math.min(box.y0, y), Math.max(box.x1, x), Math.max(box.y1, y)];
  }
  return { n, box };
}

/** Diff's pale green fill, however lit, and its dark green accent. Nothing else in these models is green. */
const greenish = (r: number, g: number, b: number) => g - r > 35 && g - b > 20;
const darkGreen = (r: number, g: number, b: number) => g > 90 && g < 150 && r < 60 && b < 80;
const paleYellow = (r: number, g: number, b: number) => r > 220 && g > 200 && b < 150;

/** Record every frame drawn while `act` runs, as small fingerprints, and return how many distinct pictures there were. */
async function picturesDuring(act: () => Promise<unknown>): Promise<number> {
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
async function findHover(status: string): Promise<{ x: number; y: number } | null> {
  for (let y = 120; y < VIEWPORT.height - 60; y += 25) {
    for (let x = 120; x < VIEWPORT.width - 300; x += 25) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(30);
      const h = await page.evaluate(() => (window as unknown as { __elmsteadHover?: { status?: string } | null }).__elmsteadHover ?? null);
      if (h?.status === status) return { x, y };
    }
  }
  return null;
}

beforeAll(async () => {
  try {
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  } catch (e) {
    if (/Executable doesn't exist|playwright install/i.test(String(e))) throw new Error("Chromium missing — it comes with npm install (@playwright/browser-chromium); if install scripts were skipped, run: npm rebuild @playwright/browser-chromium");
    throw e;
  }
  outDir = mkdtempSync(join(tmpdir(), "elmstead-diff-mode-"));
  process.env.ELMSTEAD_OUT_DIR = outDir;
  const cottage = await model("models/examples/example-cottage");
  await publish(COTTAGE, cottage);
  await publish(`${COTTAGE}@rear-extension`, await model("models/examples/example-cottage/revisions/rear-extension.ts"));
  await publish(`${COTTAGE}@no-kitchen-window`, revise(cottage, [remove("window-kitchen")]));
  // The two-storey fixture: an upper-floor wall removed, a ground-floor wall added.
  const two = await model("tests/fixtures/two-storey");
  await publish(TWO, two);
  const upperWall = two.storeys[1]!.walls.find((w) => !two.storeys[1]!.openings.some((o) => o.wallId === w.id))!;
  const shed = wall("wall-shed", pt(mm(-2000), mm(0)), pt(mm(-2000), mm(2000)), { thickness: mm(200), height: mm(2400) });
  await publish(`${TWO}@both-floors`, revise(two, [remove(upperWall.id), addTo(two.storeys[0]!.id, { walls: [shed] })]));
  // A base with its JSON but no IFC, and a revision of it.
  await publish(NOBASE, cottage, { ifc: false });
  await publish(`${NOBASE}@rear-extension`, await model("models/examples/example-cottage/revisions/rear-extension.ts"));
  server = await createServer({ configFile: "viewer/vite.config.ts", server: { port: 0 }, logLevel: "error" });
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

const REV = `model=${encodeURIComponent(`${COTTAGE}@rear-extension`)}`;
const diffParam = () => new URL(page.url()).searchParams.get("diff");
const xrayParam = () => new URL(page.url()).searchParams.get("xray");

describe("Diff mode", () => {
  it("is offered only for a revision, and toggles with the button and D", async () => {
    await open(`model=${COTTAGE}&view=se`);
    expect(await page.isHidden("#diff")).toBe(true);
    const plain = await pixels();
    await page.keyboard.press("d");
    await page.waitForTimeout(400);
    expect(same(await pixels(), plain)).toBe(true);
    expect(diffParam()).toBeNull();

    await open(`${REV}&view=se`);
    expect(await page.isHidden("#diff")).toBe(false);
    await viewChange(() => page.click("#diff"));
    expect(diffParam()).toBe("1");
    expect(await page.getAttribute("#diff", "aria-pressed")).toBe("true");
    expect(await page.evaluate(() => window.__elmsteadDiff?.added.length)).toBe(6);
    await viewChange(() => page.keyboard.press("d"));
    expect(diffParam()).toBeNull();
    expect(await page.evaluate(() => window.__elmsteadDiff)).toBeNull();
  }, 180_000);

  it("opens from a shared link, colours the changes and outlines them", async () => {
    await open(`${REV}&view=se&diff=1`);
    expect(count(await pixels(), greenish).n).toBeGreaterThan(2000);
    const outlines = await page.evaluate(() => window.__elmsteadOutlines!);
    expect(outlines.added).toBeGreaterThanOrEqual(4); // the lean-to's three walls and its slab
    expect(outlines.changed).toBeGreaterThanOrEqual(1); // the widened window
    expect(outlines.removed).toBeGreaterThanOrEqual(2); // the ghosts of the knocked-through wall and the kitchen window
  }, 120_000);

  it("restores the normal picture exactly when turned off", async () => {
    await open(`${REV}&view=se`);
    const plain = await pixels();
    expect(count(plain, greenish).n).toBe(0);
    await viewChange(() => page.click("#diff"));
    await viewChange(() => page.click("#diff"));
    expect(same(await pixels(), plain)).toBe(true);
  }, 120_000);

  it("is ignored in walk mode, where D strafes", async () => {
    await open(`${REV}&view=se&walk=1`);
    await page.keyboard.press("d");
    await page.waitForTimeout(400);
    expect(diffParam()).toBeNull();
  }, 120_000);

  it("stays on across revisions, is inactive on Existing, and keeps the camera", async () => {
    await open(`${REV}&view=sw`);
    await page.click('[data-view="top"]');
    await drawn();
    await viewChange(() => page.click("#diff"));
    const diffTop = await pixels();
    await chooseRevision("");
    expect(await page.isHidden("#diff")).toBe(true);
    expect(diffParam()).toBe("1");
    expect(count(await pixels(), greenish).n).toBe(0);
    await chooseRevision("rear-extension");
    // The same top-view Diff picture: neither the camera nor the colours moved.
    expect(same(await pixels(), diffTop)).toBe(true);
  }, 180_000);

  it("leaves no colours on a kept revision once Diff is off", async () => {
    await open(`${REV}&view=se`);
    const fresh = await pixels();
    await viewChange(() => page.click("#diff"));
    await viewChange(() => page.click("#diff"));
    await chooseRevision("no-kitchen-window");
    await chooseRevision("rear-extension");
    expect(same(await pixels(), fresh)).toBe(true);
  }, 180_000);

  it("lands each toggle and switch in one picture", async () => {
    await open(`${REV}&view=se`);
    expect(await picturesDuring(() => viewChange(() => page.click("#diff")))).toBe(2);
    expect(await picturesDuring(() => viewChange(() => page.click("#xray")))).toBe(2);
    expect(await picturesDuring(() => chooseRevision("no-kitchen-window"))).toBe(2);
  }, 180_000);
});

describe("Diff in the plan drawing", () => {
  it("colours the walls, floors and symbols from above, door swings included", async () => {
    await open(`${REV}&view=top`);
    const plain = await pixels();
    await viewChange(() => page.click("#diff"));
    const top = await pixels();
    expect(count(top, darkGreen).n).toBeGreaterThan(500); // the lean-to's wall pieces
    expect(count(top, greenish).n).toBeGreaterThan(3000); // its floor
    const yellow = count(top, paleYellow);
    expect(yellow.n).toBeGreaterThan(5000); // the knocked-through room's floor
    // The two hall doors swing into that room: their lines are still drawn over the yellow floor.
    const { x0, y0, x1, y1 } = yellow.box;
    const inside = { ...top, data: Buffer.from(top.data) };
    let dark = 0;
    for (let y = y0 + 4; y < y1 - 4; y++)
      for (let x = x0 + 4; x < x1 - 4; x++) {
        const i = (y * top.width + x) * 4;
        if (inside.data[i]! < 110 && inside.data[i + 1]! < 110 && inside.data[i + 2]! < 110) dark++;
      }
    expect(dark).toBeGreaterThan(20);
    // The demolished wall and the bricked-up window, in the removed fill, dashed red round them.
    expect(count(top, (r, g, b) => r > 235 && g > 185 && g < 220 && b > 180 && b < 215).n).toBeGreaterThan(150);
    expect(count(top, (r, g, b) => r > 170 && g < 80 && b < 90).n).toBeGreaterThan(30);
    await viewChange(() => page.click("#diff"));
    expect(same(await pixels(), plain)).toBe(true);
  }, 120_000);
});

describe("Removed elements", () => {
  it("are drawn as ghosts, and only they", async () => {
    await open(`${REV}&view=se&diff=1`);
    expect(await page.evaluate(() => window.__elmsteadGhosts)).toEqual(["wall-living-kitchen", "window-kitchen"]);
  }, 120_000);

  it("reuse a base already shown, fetching no IFC", async () => {
    await open(`model=${COTTAGE}&view=se`);
    await chooseRevision("rear-extension");
    const fetched: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith(".ifc")) fetched.push(r.url());
    });
    await viewChange(() => page.keyboard.press("d"));
    expect(await page.evaluate(() => window.__elmsteadGhosts)).toEqual(["wall-living-kitchen", "window-kitchen"]);
    expect(fetched).toEqual([]);
  }, 120_000);

  it("leave Existing exactly as it was before Diff was used", async () => {
    await open(`model=${COTTAGE}&view=se`);
    const before = await pixels();
    await chooseRevision("rear-extension");
    await viewChange(() => page.keyboard.press("d"));
    await chooseRevision("");
    expect(same(await pixels(), before)).toBe(true);
  }, 180_000);

  it("are left out of measuring, which picks the geometry behind a ghost", async () => {
    await open(`${REV}&view=se&diff=1&ids=1`);
    const at = await findHover("removed");
    expect(at, "a pointer position over a ghost").not.toBeNull();
    await page.click("#measure");
    await page.mouse.click(at!.x, at!.y);
    await page.mouse.click(at!.x + 40, at!.y);
    await page.waitForFunction(() => (window as unknown as { __elmsteadMeasurements?: unknown[] }).__elmsteadMeasurements?.length === 1, null, { timeout: 10_000 });
    const [m] = await page.evaluate(() => (window as unknown as { __elmsteadMeasurements: { from: { x: number; y: number; z: number } }[] }).__elmsteadMeasurements);
    // The ghost wall stood at plan y 3350–3450 mm (scene z −3.45…−3.35), x 200–3750 mm, 2.4 m tall:
    // the measured point is on something else, behind it.
    const { x, y, z } = m!.from;
    const onGhost = x > 0.18 && x < 3.77 && z > -3.47 && z < -3.33 && y > -0.01 && y < 2.42;
    expect(onGhost, `measured at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
  }, 180_000);

  it("still colour the rest when the base IFC is missing, with a note", async () => {
    await open(`model=${encodeURIComponent(`${NOBASE}@rear-extension`)}&view=se&diff=1`);
    expect(count(await pixels(), greenish).n).toBeGreaterThan(2000);
    expect(await page.evaluate(() => window.__elmsteadGhosts)).toEqual([]);
    expect(await page.textContent("#status")).toContain(`removed elements need ${NOBASE} built`);
  }, 120_000);
});

describe("Transparency", () => {
  it("fades every element of a base model, in 3D and in the top view, and restores it", async () => {
    for (const view of ["se", "top"]) {
      await open(`model=${COTTAGE}&view=${view}`);
      const plain = await pixels();
      await viewChange(() => page.click("#xray"));
      expect(xrayParam()).toBe("1");
      expect(same(await pixels(), plain), view).toBe(false);
      await viewChange(() => page.click("#xray"));
      expect(same(await pixels(), plain), view).toBe(true);
    }
  }, 180_000);

  it("keeps the changes solid with Diff on, and stays on across switches", async () => {
    await open(`${REV}&view=se&diff=1`);
    const solid = count(await pixels(), greenish).n;
    await viewChange(() => page.click("#xray"));
    expect(count(await pixels(), greenish).n).toBeGreaterThan(solid * 0.8);
    await chooseRevision("");
    expect(await page.getAttribute("#xray", "aria-pressed")).toBe("true");
    expect(xrayParam()).toBe("1");
  }, 180_000);
});

describe("Changes panel", () => {
  it("counts each category and hides it when unchecked", async () => {
    await open(`${REV}&view=se&diff=1`);
    const text = await page.textContent("#changes");
    expect(text).toContain("6 added");
    expect(text).toContain("2 changed");
    expect(text).toContain("3 removed");
    await viewChange(() => page.uncheck('#changes input[data-status="added"]'));
    expect(count(await pixels(), greenish).n).toBe(0);
    await viewChange(() => page.uncheck('#changes input[data-status="removed"]'));
    expect(await page.evaluate(() => window.__elmsteadGhosts)).toEqual([]);
    await viewChange(() => page.click("#diff"));
    expect(await page.isHidden("#changes")).toBe(true);
  }, 180_000);

  it("lists only the shown storeys' changes, and hides the other storeys' ghosts", async () => {
    await open(`model=${encodeURIComponent(`${TWO}@both-floors`)}&view=se&diff=1`);
    const all = await page.$$eval("#changes li button", (bs) => bs.map((b) => b.getAttribute("data-id")));
    expect(all).toContain("wall-shed");
    expect(all.length).toBe(2);
    await open(`model=${encodeURIComponent(`${TWO}@both-floors`)}&view=se&diff=1&storeys=storey-ground`);
    expect(await page.$$eval("#changes li button", (bs) => bs.map((b) => b.getAttribute("data-id")))).toEqual(["wall-shed"]);
    // The removed wall is upstairs, hidden: its ghost draws nothing, so hiding the category changes nothing.
    const withGhost = await pixels();
    await viewChange(() => page.uncheck('#changes input[data-status="removed"]'));
    expect(same(await pixels(), withGhost)).toBe(true);
  }, 180_000);

  it("frames a clicked change", async () => {
    await open(`${REV}&view=se&diff=1`);
    const before = count(await pixels(), greenish).n;
    await viewChange(() => page.click('#changes li button[data-id="wall-lean-to-north"]'));
    expect(count(await pixels(), greenish).n).toBeGreaterThan(before * 2);
  }, 120_000);
});

describe("Hover in Diff mode", () => {
  it("adds the status to an added element and names a ghost as removed", async () => {
    await open(`${REV}&view=se&diff=1&ids=1`);
    expect(await findHover("added"), "an added element under the pointer").not.toBeNull();
    expect(await findHover("removed"), "a ghost under the pointer").not.toBeNull();
  }, 300_000);
});
