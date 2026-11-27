import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render3d } from "../src/backend/render/index.js";
import { VIEWS } from "../src/shared/render/views.js";
import { canvasPixels, model, page, publish, samePixels, useViewer, viewOf } from "./support/viewer-page.js";

useViewer();

describe("render3d", () => {
  it("reports a viewer failure as an ERROR and closes the server", async () => {
    const dir = mkdtempSync(join(tmpdir(), "elmstead-snapshot-"));
    try {
      const r = await render3d("missing-model", dir);
      expect(r.written).toEqual([]);
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]).toMatchObject({ level: "ERROR", id: "missing-model.ifc" });
      expect(r.issues[0]!.message).toMatch(/^3D snapshots failed:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describe("snapshot view switching", () => {
  it("switching views in one page counts and matches fresh loads, pixel for pixel", async () => {
    await publish("test-snapshot-views", await model("models/examples/example-cottage"));
    const fresh = [];
    for (const view of VIEWS) fresh.push(await viewOf("test-snapshot-views", `view=${view}&snapshot=1&labels=0`));
    await viewOf("test-snapshot-views", `view=${VIEWS[0]}&snapshot=1&labels=0`);
    for (const [i, view] of VIEWS.slice(1).entries()) {
      const before = await page.evaluate(() => window.__elmsteadViews ?? 0);
      await page.evaluate((v) => window.__elmsteadChooseView!(v), view);
      await page.waitForFunction((n) => (window.__elmsteadViews ?? 0) > n, before, { timeout: 60_000 });
      expect(samePixels(await canvasPixels(), fresh[i + 1]!), `view ${view}`).toBe(true);
    }
  }, 180_000);

  it("an in-page top switch matches a fresh top on a model with a north angle", async () => {
    // elmstead's northAngle turns the Top camera, so the turned-fit path is exercised too.
    await publish("test-snapshot-turned", await model("models/elmstead"));
    const fresh = await viewOf("test-snapshot-turned", "view=top&snapshot=1&labels=0");
    await viewOf("test-snapshot-turned", "view=sw&snapshot=1&labels=0");
    const before = await page.evaluate(() => window.__elmsteadViews ?? 0);
    await page.evaluate(() => window.__elmsteadChooseView!("top"));
    await page.waitForFunction((n) => (window.__elmsteadViews ?? 0) > n, before, { timeout: 60_000 });
    expect(samePixels(await canvasPixels(), fresh)).toBe(true);
  }, 180_000);

  it("an interactive view choice settles and counts", async () => {
    await publish("test-snapshot-views", await model("models/examples/example-cottage"));
    await viewOf("test-snapshot-views", "view=top&labels=0");
    const before = await page.evaluate(() => window.__elmsteadViews ?? 0);
    await page.click('button.camera-snap[data-view="front"]');
    await page.waitForFunction((n) => (window.__elmsteadViews ?? 0) > n, before, { timeout: 60_000 });
  }, 120_000);
});
