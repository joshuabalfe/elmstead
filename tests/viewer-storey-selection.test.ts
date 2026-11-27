/**
 * The viewer's navigation rail: the floor picker and the storeys URL parameter, the camera crosses
 * and the First Person switch. See plan-vs-3d.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  canvasPixels,
  model,
  page,
  publish,
  samePixels,
  selectStorey,
  useViewer,
  viewOf,
} from "./support/viewer-page.js";

useViewer();

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
    const hidden = await viewOf(
      "test-hidden-storey",
      `view=se&snapshot=1&labels=0&style=ifc&camera=${camera}&storeys=storey-basement,storey-street,storey-ground,storey-main-half-landing,storey-first-floor,storey-attic-half-landing`,
    );
    const absent = await viewOf("test-below-top", `view=se&snapshot=1&labels=0&style=ifc&camera=${camera}`);
    // Hiding a storey must be the same picture as a model that never had it: same pixels, every one
    // of them. The camera is pinned by the URL, so this proves geometry hiding but not hiding under
    // auto-framing (which drifts sub-pixel with the hidden storey's bounds); that is a known gap.
    expect(Buffer.from(hidden.data).equals(Buffer.from(absent.data))).toBe(true);
  }, 120_000);

  it("is a vertical slider with a notch per storey, highest at the top", async () => {
    const m = await model("models/elmstead");
    await publish("test-storey-slider", m);
    await viewOf("test-storey-slider", "view=top&labels=0&style=plan");
    const lowestFirst = [...m.storeys].sort((a, b) => a.elevation - b.elevation);
    const notches = await page.evaluate(() =>
      [...document.querySelectorAll("#bar .storey-option")].map((el) => ({
        id: el.getAttribute("data-storey"),
        top: el.getBoundingClientRect().top,
      })),
    );
    expect(notches.map((notch) => notch.id)).toEqual(lowestFirst.map((storey) => storey.id));
    expect(notches.every((notch, i) => i === 0 || notch.top < notches[i - 1]!.top)).toBe(true);
    expect(await page.getAttribute("#storeys", "aria-orientation")).toBe("vertical");
    expect(await page.getAttribute("#storeys", "aria-label")).toBe("Levels");
    expect(await page.locator('#storeys svg[data-icon="eye-open"]').count()).toBe(1);
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
    const groundOnly = await viewOf(
      "test-storey-selector",
      `view=top&labels=0&style=plan&camera=${camera}&storeys=storey-basement,storey-street,storey-ground`,
    );
    expect(samePixels(ground, groundOnly)).toBe(true);

    // The topmost choice puts the attic back, still without moving the camera.
    await selectStorey("storey-attic");
    expect(new URL(page.url()).searchParams.has("storeys")).toBe(false);
    expect(samePixels(await canvasPixels(), all)).toBe(true);

    // A URL subset no single floor describes reads as custom rather than as some floor.
    await viewOf("test-storey-selector", `view=top&labels=0&style=plan&camera=${camera}&storeys=storey-first-floor`);
    expect(await page.getAttribute("#storeys", "data-storey")).toBe("");
    expect(await page.textContent(".storey-custom")).toBe("Custom");
  }, 120_000);

  it("retargets when another floor is chosen before the change finishes", async () => {
    const m = await model("models/elmstead");
    await publish("test-storey-retarget", m);
    const camera = "16,11,6,5.2,1.5,-4.2";
    const query = `view=top&labels=0&style=plan&camera=${camera}`;
    await viewOf("test-storey-retarget", query);
    const before = await page.evaluate(() => window.__elmsteadStoreyChanges ?? 0);
    // No waiting between choices: each retargets the sweep already in flight.
    const targets = ["storey-ground", "storey-first-floor", "storey-street", "storey-basement"];
    for (const id of targets) await page.click(`#bar .storey-option[data-storey="${id}"]`);
    await page.waitForFunction((n: number) => (window.__elmsteadStoreyChanges ?? 0) >= n, before + targets.length, {
      timeout: 60_000,
    });
    expect(new URL(page.url()).searchParams.get("storeys")).toBe("storey-basement");
    // The rapid run settles exactly as a fresh load of the final selection does.
    const rapid = await canvasPixels();
    const fresh = await viewOf("test-storey-retarget", `${query}&storeys=storey-basement`);
    expect(samePixels(rapid, fresh)).toBe(true);
  }, 120_000);

  it("sweeps the floor change with Transparency on, and settles see-through", async () => {
    const m = await model("models/elmstead");
    await publish("test-storey-xray", m);
    const camera = "16,11,6,5.2,1.5,-4.2";
    const query = `view=top&labels=0&style=plan&camera=${camera}&xray=1`;
    await viewOf("test-storey-xray", query);
    const sweeps = await page.evaluate(() => window.__elmsteadStoreySweeps ?? 0);
    await selectStorey("storey-ground");
    // Transparency must not fall back to hiding and showing the floors at once.
    expect(await page.evaluate(() => window.__elmsteadStoreySweeps ?? 0)).toBe(sweeps + 1);
    // The sweep hands over to the same see-through picture as a fresh load of that floor.
    const swept = await canvasPixels();
    const fresh = await viewOf("test-storey-xray", `${query}&storeys=storey-basement,storey-street,storey-ground`);
    expect(samePixels(swept, fresh)).toBe(true);
  }, 120_000);
});

describe("camera controls", () => {
  it("puts Front above Back in the elevations cross", async () => {
    await publish("test-camera-cross", await model("models/examples/example-cottage"));
    await viewOf("test-camera-cross", "view=top&labels=0&style=plan");
    const box = async (view: string) => {
      const found = await page.locator(`[data-view="${view}"]`).boundingBox();
      if (!found) throw new Error(`the ${view} button is not visible`);
      return found;
    };
    const [front, back, left, right, top] = await Promise.all([
      box("front"),
      box("back"),
      box("left"),
      box("right"),
      box("top"),
    ]);
    expect(front.y).toBeLessThan(top.y);
    expect(top.y).toBeLessThan(back.y);
    expect(left.x).toBeLessThan(top.x);
    expect(top.x).toBeLessThan(right.x);
  }, 120_000);

  it("starts with First Person off and disables the camera snaps while it is on", async () => {
    await publish("test-first-person", await model("models/examples/example-cottage"));
    const cameraViews = ["front", "back", "left", "right", "top", "n", "e", "s", "w"] as const;
    const disabled = async () => Promise.all(cameraViews.map((view) => page.isDisabled(`[data-view="${view}"]`)));

    await viewOf("test-first-person", "view=top&labels=0&style=plan");
    expect(await page.isChecked("#walk")).toBe(false);
    expect(await disabled()).toEqual(cameraViews.map(() => false));

    await page.click("label:has(#walk)");
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#walk")?.checked === true);
    expect(await disabled()).toEqual(cameraViews.map(() => true));

    await viewOf("test-first-person", "view=top&labels=0&style=plan&walk=1");
    expect(await page.isChecked("#walk")).toBe(true);
    expect(await disabled()).toEqual(cameraViews.map(() => true));

    await page.click("label:has(#walk)");
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#walk")?.checked === false);
    expect(await disabled()).toEqual(cameraViews.map(() => false));
  }, 120_000);

  it("flies up and down with E and Q in first-person mode", async () => {
    await publish("test-free-fly", await model("models/examples/example-cottage"));
    await viewOf("test-free-fly", "view=top&labels=0&style=plan&walk=1");
    const start = await canvasPixels();

    await page.keyboard.down("e");
    await page.waitForTimeout(500);
    await page.keyboard.up("e");
    await page.waitForTimeout(100);
    const up = await canvasPixels();
    expect(samePixels(up, start)).toBe(false);

    await page.keyboard.down("q");
    await page.waitForTimeout(500);
    await page.keyboard.up("q");
    await page.waitForTimeout(100);
    const down = await canvasPixels();
    expect(samePixels(down, up)).toBe(false);
  }, 120_000);

  it("keeps the camera where it is when First Person is switched off and on", async () => {
    await publish("test-first-person-stay", await model("models/examples/example-cottage"));
    await viewOf("test-first-person-stay", "view=top&labels=0&style=plan&walk=1");
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#walk")?.checked === true);
    await page.waitForTimeout(100);
    const before = await canvasPixels();

    await page.click("label:has(#walk)");
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#walk")?.checked === false);
    await page.waitForTimeout(250);
    const off = await canvasPixels();
    expect(samePixels(off, before)).toBe(true);

    await page.click("label:has(#walk)");
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#walk")?.checked === true);
    await page.waitForTimeout(250);
    const on = await canvasPixels();
    expect(samePixels(on, off)).toBe(true);
  }, 120_000);
});
