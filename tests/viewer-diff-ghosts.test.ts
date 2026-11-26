/**
 * Diff mode's removed elements (ghosts), Transparency and hover status in the viewer. See
 * viewer-diff-mode.test.ts, which has the toggles, colours, plan drawing and changes panel.
 */
import { describe, expect, it } from "vitest";
import { COTTAGE, ELM, NOBASE, REV, chooseRevision, count, faintGreen, findHover, greenish, open, page, pixels, same, viewChange, xrayParam, useDiffMode } from "./support/diff-mode-page.js";

useDiffMode();

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

  it("keeps a faded stair's tread bands rather than the IFC's safe green", async () => {
    // Fading gives every material a new copy; the stair's must get the stair presentation too.
    await open(`model=${ELM}&view=nw&storeys=storey-basement,storey-street,storey-ground&xray=1`);
    expect(count(await pixels(), faintGreen).n).toBe(0);
  }, 120_000);

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

describe("Hover in Diff mode", () => {
  it("adds the status to an added element and names a ghost as removed", async () => {
    await open(`${REV}&view=se&diff=1&ids=1`);
    expect(await findHover("added"), "an added element under the pointer").not.toBeNull();
    expect(await findHover("removed"), "a ghost under the pointer").not.toBeNull();
  }, 300_000);
});
