/** The viewer's floor picker and the storeys URL parameter. See plan-vs-3d.test.ts. */
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
    const picker = await page.evaluate(() => {
      const s = document.getElementById("storeys") as HTMLSelectElement;
      return { value: s.value, text: s.selectedOptions[0]?.textContent };
    });
    expect(picker).toEqual({ value: "", text: "Custom" });
  }, 120_000);
});
