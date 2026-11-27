/** The storey keyboard shortcut (ArrowUp / ArrowDown) in the viewer. See plan-vs-3d.test.ts. */
import { beforeAll, describe, expect, it } from "vitest";
import { canvasPixels, model, page, publish, samePixels, useViewer, viewOf } from "./support/viewer-page.js";

useViewer();

describe("storey keyboard shortcut", () => {
  const ALL = [
    "storey-basement",
    "storey-street",
    "storey-ground",
    "storey-main-half-landing",
    "storey-first-floor",
    "storey-attic-half-landing",
    "storey-attic",
  ];
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
    await page.waitForFunction((n: number) => (window.__elmsteadStoreyChanges ?? 0) > n, before + 1, {
      timeout: 60_000,
    });
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
