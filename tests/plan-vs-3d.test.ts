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
import cottage from "../models/examples/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import { renderPlan } from "../src/render/plan.js";
import { svgToPixels } from "../src/render/png.js";
import { MARGIN, PNG_ZOOM } from "../src/render/style.js";
import { C } from "../src/render/style.js";
import type { BuildingModel, Storey } from "../src/schema/schema.js";
import { comparePlanTo3d, isIgnoredColour, type Raster } from "./support/plan-vs-3d.js";

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

/**
 * The viewer's Top view in plan style, labels off, as raw pixels from its WebGL canvas. Plan +y up
 * (`orient=project`), as the plan is drawn here, so walls lie along pixel rows and columns.
 */
async function topView(name: string, storeyId?: string): Promise<Raster> {
  const storeys = storeyId ? `&storeys=${encodeURIComponent(storeyId)}` : "";
  return viewOf(name, `view=top&snapshot=1&labels=0&style=plan&orient=project${storeys}`);
}

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

describe("storey keyboard shortcut", () => {
  const ALL = ["storey-basement", "storey-street", "storey-ground", "storey-main-half-landing", "storey-first-floor", "storey-attic-half-landing", "storey-attic"];
  // A fixed camera makes a re-frame detectable: every picture must come from the same viewpoint.
  const camera = "16,11,6,5.2,1.5,-4.2";
  const open = (query = "") => viewOf("test-storey-keys", `view=top&labels=0&style=plan&camera=${camera}${query}`);
  const changes = () => page.evaluate(() => window.__elmsteadStoreyChanges ?? 0);
  const storeysParam = () => new URL(page.url()).searchParams.get("storeys");
  const selected = () => page.inputValue("#storeys");

  beforeAll(async () => {
    await publish("test-storey-keys", structuredClone(await model("models/elmstead")));
  }, 120_000);

  /** Press a key and wait until the viewer has applied and drawn the floor it chose. */
  async function step(key: string) {
    const before = await changes();
    await page.keyboard.press(key);
    await page.waitForFunction((n: number) => (window.__elmsteadStoreyChanges ?? 0) > n, before, { timeout: 60_000 });
  }

  /** Press a key and check that nothing about the storey selection moved. */
  async function ignored(key: string) {
    const [n, param, value] = [await changes(), storeysParam(), await selected().catch(() => null)];
    await page.keyboard.press(key);
    await page.waitForTimeout(500);
    expect(await changes()).toBe(n);
    expect(storeysParam()).toBe(param);
    expect(await selected().catch(() => null)).toBe(value);
  }

  it("steps down and up through every floor and stops at both ends", async () => {
    const all = await open();
    expect(await selected()).toBe("storey-attic");

    // Nothing above the attic, and the camera has not moved.
    await ignored("ArrowUp");
    expect(samePixels(await canvasPixels(), all)).toBe(true);

    for (let i = ALL.length - 2; i >= 0; i--) {
      await step("ArrowDown");
      expect(await selected()).toBe(ALL[i]);
      expect(storeysParam()).toBe(ALL.slice(0, i + 1).join(","));
    }
    // Nothing below the basement: no wrap round to the attic.
    await ignored("ArrowDown");
    expect(await selected()).toBe("storey-basement");

    for (let i = 1; i < ALL.length; i++) {
      await step("ArrowUp");
      expect(await selected()).toBe(ALL[i]);
    }
    // Back on the topmost floor: the parameter is cleared and the picture is the one we started with.
    expect(storeysParam()).toBeNull();
    expect(samePixels(await canvasPixels(), all)).toBe(true);
  }, 180_000);

  it("steps like the selector does: same picture as choosing the floor", async () => {
    await open();
    await step("ArrowDown");
    const stepped = await canvasPixels();
    const chosen = await open(`&storeys=${ALL.slice(0, -1).join(",")}`);
    expect(samePixels(stepped, chosen)).toBe(true);
  }, 120_000);

  it("steps a custom selection from its highest storey", async () => {
    await open("&storeys=storey-first-floor");
    expect(await selected()).toBe("");
    await step("ArrowDown");
    expect(await selected()).toBe("storey-main-half-landing");
    expect(storeysParam()).toBe("storey-basement,storey-street,storey-ground,storey-main-half-landing");

    await open("&storeys=storey-street");
    await step("ArrowUp");
    expect(await selected()).toBe("storey-ground");
  }, 120_000);

  it("steps the selector exactly once while it has focus, and holding the key steps once", async () => {
    await open();
    await page.focus("#storeys");
    // Registered after the viewer's own handler, so it sees whether that handler took the key: a
    // focused select would otherwise also move itself, and the opposite way round.
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { __prevented: boolean[] }).__prevented = seen;
      window.addEventListener("keydown", (e) => seen.push(e.defaultPrevented));
    });
    const before = await changes();
    await step("ArrowDown");
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __prevented: boolean[] }).__prevented)).toEqual([true]);
    expect(await changes()).toBe(before + 1);
    expect(await selected()).toBe("storey-attic-half-landing");

    // Auto-repeat after the first press is ignored until the key is released.
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction((n: number) => (window.__elmsteadStoreyChanges ?? 0) > n, before + 1, { timeout: 60_000 });
    await page.keyboard.down("ArrowDown");
    await page.keyboard.down("ArrowDown");
    await page.keyboard.up("ArrowDown");
    await page.waitForTimeout(500);
    expect(await selected()).toBe("storey-first-floor");
    expect(await changes()).toBe(before + 2);
  }, 120_000);

  it("ignores modifiers and other form controls", async () => {
    await open();
    await ignored("Shift+ArrowDown");
    await ignored("Control+ArrowDown");
    await ignored("Alt+ArrowDown");
    await ignored("Meta+ArrowDown");

    // A synthetic key press on the model picker: the real one would change the model by itself.
    const prevented = await page.evaluate(() => {
      const e = new KeyboardEvent("keydown", { code: "ArrowDown", bubbles: true, cancelable: true });
      document.getElementById("model")!.dispatchEvent(e);
      return e.defaultPrevented;
    });
    await page.waitForTimeout(500);
    expect(prevented).toBe(false);
    expect(storeysParam()).toBeNull();
    expect(await selected()).toBe("storey-attic");
  }, 120_000);

  it("does nothing for a single-storey model, in snapshots and in walk mode", async () => {
    await publish("test-storey-keys-single", await model("models/examples/example-cottage"));
    await viewOf("test-storey-keys-single", "view=top&labels=0&style=plan");
    expect(await page.isHidden("#storeys")).toBe(true);
    await ignored("ArrowDown");
    await ignored("ArrowUp");

    await viewOf("test-storey-keys", `view=top&labels=0&style=plan&camera=${camera}&snapshot=1`);
    await ignored("ArrowDown");

    // In walk mode the arrows walk: the view moves and the selection does not.
    await viewOf("test-storey-keys", "labels=0&style=plan&walk=1");
    const start = await canvasPixels();
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowUp");
    expect(samePixels(await canvasPixels(), start)).toBe(false);
    expect(storeysParam()).toBeNull();
    expect(await selected()).toBe("storey-attic");
    expect(await changes()).toBe(0);
  }, 180_000);
});

describe("railing presentation", () => {
  const near = (r: Raster, rgb: [number, number, number], tol: number): number => {
    let n = 0;
    for (let i = 0; i < r.data.length; i += 4) {
      if (Math.abs(r.data[i]! - rgb[0]) <= tol && Math.abs(r.data[i + 1]! - rgb[1]) <= tol && Math.abs(r.data[i + 2]! - rgb[2]) <= tol) n++;
    }
    return n;
  };
  const railing: [number, number, number] = [74, 81, 90]; // STYLES.railing, the IFC colour

  it("shows the railings in 3D and hides them with the street storey", async () => {
    const m = structuredClone(await model("models/elmstead"));
    await publish("test-railing-view", m);
    const noRailings = structuredClone(m);
    for (const s of noRailings.storeys) s.railings = [];
    await publish("test-railing-none", noRailings);
    // A fixed camera keeps both pictures at the same scale; the front is to the west.
    const q = "view=sw&labels=0&camera=-12,8,8,0,1,-4";
    for (const style of ["plan", "ifc"]) {
      const withRail = await viewOf("test-railing-view", `${q}&snapshot=1&style=${style}`);
      const without = await viewOf("test-railing-none", `${q}&snapshot=1&style=${style}`);
      expect(near(withRail, railing, 70), style).toBeGreaterThan(near(without, railing, 70) + 500);
    }
    // All four railings are on the street storey; hiding it hides them with the rest of the street.
    const hidden = `${q}&snapshot=1&style=ifc&storeys=storey-basement,storey-ground,storey-first-floor`;
    expect(samePixels(await viewOf("test-railing-view", hidden), await viewOf("test-railing-none", hidden))).toBe(true);
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

describe("ground presentation", () => {
  const near = (r: Raster, rgb: [number, number, number], tol: number): number => {
    let n = 0;
    for (let i = 0; i < r.data.length; i += 4) {
      if (Math.abs(r.data[i]! - rgb[0]) <= tol && Math.abs(r.data[i + 1]! - rgb[1]) <= tol && Math.abs(r.data[i + 2]! - rgb[2]) <= tol) n++;
    }
    return n;
  };
  const ground: [number, number, number] = [102, 102, 102]; // STYLES.ground, sRGB

  it("shows a ground slab in the ground colour and not as concrete", async () => {
    const m = await model("models/examples/example-cottage");
    m.storeys[0]!.slabs[0]!.material = "ground";
    m.storeys[0]!.rooms = []; // expose the slab's fill in the plan-style floor
    await publish("test-ground-presentation", m);
    const plain = await model("models/examples/example-cottage");
    plain.storeys[0]!.rooms = [];
    await publish("test-ground-concrete", plain);

    // The plan-style floor fill is unlit, so the ground colour is exact.
    const plan = await viewOf("test-ground-presentation", "view=top&labels=0&style=plan");
    expect(near(plan, [102, 102, 102], 6)).toBeGreaterThan(1000);

    // In IFC style the slab top is lit, so compare the ground model against a concrete copy.
    const withGround = await viewOf("test-ground-presentation", "view=top&labels=0&style=ifc");
    const concrete = await viewOf("test-ground-concrete", "view=top&labels=0&style=ifc");
    expect(near(withGround, ground, 30)).toBeGreaterThan(near(concrete, ground, 30) + 1000);
  }, 120_000);
});

describe("overlay textures", () => {
  /** Records each texture allocation's level-0 size before the viewer's scripts run. */
  const RECORD_TEXTURES = `
    window.__textures = [];
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const storage = proto.texStorage2D;
      if (storage) proto.texStorage2D = function (target, levels, format, w, h) { window.__textures.push([w, h]); return storage.apply(this, arguments); };
      const image = proto.texImage2D;
      proto.texImage2D = function () {
        const a = arguments;
        if (a[1] === 0) { const src = a.length >= 9 ? { width: a[3], height: a[4] } : a[5]; window.__textures.push([src?.videoWidth ?? src?.width ?? 0, src?.videoHeight ?? src?.height ?? 0]); }
        return image.apply(this, a);
      };
    }`;

  it("uploads no texture over 1024 × 1024 texels, whatever the storey's footprint", async () => {
    await publish("test-overlay-textures", await model("models/elmstead"));
    const p = await browser!.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    try {
      await p.addInitScript(RECORD_TEXTURES);
      // Plan style with labels on, as the viewer opens: every overlay and label is drawn.
      await p.goto(`${server!.resolvedUrls!.local[0]!}?model=test-overlay-textures&view=top`);
      await p.waitForFunction("window.__elmsteadReady || window.__elmsteadError", null, { timeout: 60_000 });
      expect(await p.evaluate("window.__elmsteadError")).toBeUndefined();
      const sizes = (await p.evaluate("window.__textures")) as [number, number][];
      expect(sizes.length).toBeGreaterThan(0);
      const largest = sizes.reduce((a, s) => (s[0] * s[1] > a[0] * a[1] ? s : a));
      expect(largest[0] * largest[1], `largest texture ${largest[0]}×${largest[1]}`).toBeLessThanOrEqual(1024 * 1024);
    } finally {
      await p.close();
    }
  }, 120_000);
});
