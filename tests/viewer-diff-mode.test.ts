/**
 * Diff mode in the viewer: the toggles, the colours and outlines, the plan drawing and the changes
 * panel. Publishes the cottage with its rear extension and a second revision, the two-storey
 * fixture with a revision that changes both floors, and a revision whose base has JSON but no IFC.
 * The ghosts, transparency and hover tests are in viewer-diff-ghosts.test.ts; they share
 * tests/support/diff-mode-page.ts and run as separate CI jobs.
 */
import { describe, expect, it } from "vitest";
import {
  COTTAGE,
  REV,
  TWO,
  addedFloor,
  changedFloor,
  chooseRevision,
  count,
  darkGreen,
  diffParam,
  drawn,
  greenish,
  open,
  page,
  picturesDuring,
  pixels,
  same,
  viewChange,
  useDiffMode,
} from "./support/diff-mode-page.js";

useDiffMode();

describe("Diff mode", () => {
  it("is shown disabled without a revision, and toggles with the switch and D", async () => {
    await open(`model=${COTTAGE}&view=se`);
    expect(await page.isVisible("#diff")).toBe(true);
    expect(await page.isDisabled("#diff")).toBe(true);
    const plain = await pixels();
    await page.keyboard.press("d");
    await page.waitForTimeout(400);
    expect(same(await pixels(), plain)).toBe(true);
    expect(diffParam()).toBeNull();

    await open(`${REV}&view=se`);
    expect(await page.isDisabled("#diff")).toBe(false);
    await viewChange(() => page.click("label:has(#diff)"));
    expect(diffParam()).toBe("1");
    expect(await page.isChecked("#diff")).toBe(true);
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
    await viewChange(() => page.click("label:has(#diff)"));
    await viewChange(() => page.click("label:has(#diff)"));
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
    await viewChange(() => page.click("label:has(#diff)"));
    const diffTop = await pixels();
    await chooseRevision("");
    expect(await page.isVisible("#diff")).toBe(true);
    expect(await page.isDisabled("#diff")).toBe(true);
    expect(await page.isChecked("#diff")).toBe(false);
    expect(diffParam()).toBe("1");
    expect(count(await pixels(), greenish).n).toBe(0);
    await chooseRevision("rear-extension");
    expect(await page.isDisabled("#diff")).toBe(false);
    expect(await page.isChecked("#diff")).toBe(true);
    // The same top-view Diff picture: neither the camera nor the colours moved.
    expect(same(await pixels(), diffTop)).toBe(true);
  }, 180_000);

  it("leaves no colours on a kept revision once Diff is off", async () => {
    await open(`${REV}&view=se`);
    const fresh = await pixels();
    await viewChange(() => page.click("label:has(#diff)"));
    await viewChange(() => page.click("label:has(#diff)"));
    await chooseRevision("no-kitchen-window");
    await chooseRevision("rear-extension");
    expect(same(await pixels(), fresh)).toBe(true);
  }, 180_000);

  it("lands each toggle and switch in one picture", async () => {
    await open(`${REV}&view=se`);
    expect(await picturesDuring(() => viewChange(() => page.click("label:has(#diff)")))).toBe(2);
    expect(await picturesDuring(() => viewChange(() => page.click("label:has(#xray)")))).toBe(2);
    expect(await picturesDuring(() => chooseRevision("no-kitchen-window"))).toBe(2);
  }, 180_000);

  it("crossfades the Diff and Transparency toggles", async () => {
    await open(`${REV}&view=se`);
    for (const id of ["#diff", "#xray"]) {
      const { fades, changes } = await page.evaluate(() => ({
        fades: window.__elmsteadViewFades ?? 0,
        changes: window.__elmsteadViewChanges ?? 0,
      }));
      await page.click(`label:has(${id})`);
      // The previous picture is copied over the canvas, then fades as the new one is drawn.
      await page.waitForFunction((n: number) => (window.__elmsteadViewFades ?? 0) > n, fades, { timeout: 60_000 });
      await page.waitForFunction((n: number) => (window.__elmsteadViewChanges ?? 0) > n, changes, {
        timeout: 60_000,
      });
      expect(await page.locator("[data-view-fade]").count()).toBe(0);
    }
  }, 180_000);

  it("replaces the picture in one frame with reduced motion", async () => {
    await open(`${REV}&view=se`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    try {
      const before = await page.evaluate(() => ({
        fades: window.__elmsteadViewFades ?? 0,
        changes: window.__elmsteadViewChanges ?? 0,
      }));
      await page.click("label:has(#xray)");
      await page.waitForFunction((n: number) => (window.__elmsteadViewChanges ?? 0) > n, before.changes, {
        timeout: 60_000,
      });
      expect(await page.evaluate(() => window.__elmsteadViewFades ?? 0)).toBe(before.fades);
    } finally {
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
  }, 120_000);
});

describe("Diff in the plan drawing", () => {
  it("colours the walls, new floor and symbols from above, and leaves floor that only changed room untinted", async () => {
    await open(`${REV}&view=top`);
    const plain = await pixels();
    await viewChange(() => page.click("label:has(#diff)"));
    const top = await pixels();
    expect(count(top, darkGreen).n).toBeGreaterThan(500); // the lean-to's wall pieces
    expect(count(top, addedFloor).n).toBeGreaterThan(3000); // its floor
    // The knocked-through room only changed which room its floor is in: no tint, just its outline.
    expect(count(top, changedFloor).n).toBeLessThan(100);
    // The demolished wall and the bricked-up window, in the removed fill, dashed red round them.
    expect(count(top, (r, g, b) => r > 235 && g > 185 && g < 220 && b > 180 && b < 215).n).toBeGreaterThan(150);
    expect(count(top, (r, g, b) => r > 170 && g < 80 && b < 90).n).toBeGreaterThan(30);
    await viewChange(() => page.click("label:has(#diff)"));
    expect(same(await pixels(), plain)).toBe(true);
  }, 120_000);
});

describe("Changes panel", () => {
  it("counts each category and hides it when unchecked", async () => {
    await open(`${REV}&view=se&diff=1`);
    const text = await page.textContent("#changes");
    expect(text).toContain("6 added");
    expect(text).toContain("7 changed");
    expect(text).toContain("3 removed");
    await viewChange(() => page.uncheck('#changes input[data-status="added"]'));
    expect(count(await pixels(), greenish).n).toBe(0);
    await viewChange(() => page.uncheck('#changes input[data-status="removed"]'));
    expect(await page.evaluate(() => window.__elmsteadGhosts)).toEqual([]);
    await viewChange(() => page.click("label:has(#diff)"));
    expect(await page.isHidden("#changes")).toBe(true);
  }, 180_000);

  it("lists only the shown storeys' changes, and hides the other storeys' ghosts", async () => {
    await open(`model=${encodeURIComponent(`${TWO}@both-floors`)}&view=se&diff=1`);
    const all = await page.$$eval("#changes li button", (bs) => bs.map((b) => b.getAttribute("data-id")));
    expect(all).toContain("wall-shed");
    expect(all.length).toBe(2);
    await open(`model=${encodeURIComponent(`${TWO}@both-floors`)}&view=se&diff=1&storeys=storey-ground`);
    expect(await page.$$eval("#changes li button", (bs) => bs.map((b) => b.getAttribute("data-id")))).toEqual([
      "wall-shed",
    ]);
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
