/** How the viewer presents railings, furnishings, stairs, the ground slab and overlay textures. See plan-vs-3d.test.ts. */
import { describe, expect, it } from "vitest";
import {
  browser,
  model,
  near,
  publish,
  samePixels,
  server,
  useViewer,
  viewOf,
  VIEWPORT,
} from "./support/viewer-page.js";
import { furnishing, m, mm, pt } from "../src/backend/model/index.js";

useViewer();

describe("railing presentation", () => {
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

describe("furnishing presentation", () => {
  const furniture: [number, number, number] = [194, 158, 107]; // STYLES.furniture, the IFC colour
  const sanitary: [number, number, number] = [158, 199, 219]; // STYLES.sanitary
  const strip = (src: Awaited<ReturnType<typeof model>>) => {
    const bare = structuredClone(src);
    for (const s of bare.storeys) s.furnishings = [];
    return bare;
  };

  it("shows furniture and sanitary fittings in their own colours, in plan style and IFC style", async () => {
    const furnished = await model("models/examples/example-cottage/revisions/furnished");
    await publish("test-furnished-view", furnished);
    await publish("test-furnished-none", strip(furnished));
    const q = "view=top&labels=0&snapshot=1";
    for (const style of ["plan", "ifc"]) {
      const withItems = await viewOf("test-furnished-view", `${q}&style=${style}`);
      const without = await viewOf("test-furnished-none", `${q}&style=${style}`);
      expect(near(withItems, furniture, 40), `${style} furniture`).toBeGreaterThan(near(without, furniture, 40) + 500);
      expect(near(withItems, sanitary, 40), `${style} sanitary`).toBeGreaterThan(near(without, sanitary, 40) + 500);
    }
  }, 120_000);

  it("hides furnishings with their storey and shows them with it", async () => {
    const two = await model("tests/fixtures/two-storey");
    const furnishedTwo = structuredClone(two);
    furnishedTwo.storeys.find((s) => s.id === "storey-ground")!.furnishings = [
      furnishing("table-ground", "table", pt(mm(2000), mm(2000))),
    ];
    await publish("test-furnished-two", furnishedTwo);
    await publish("test-furnished-two-none", strip(furnishedTwo));
    const q = "view=top&labels=0&snapshot=1&style=ifc";
    const hidden = `${q}&storeys=storey-first`;
    expect(
      samePixels(await viewOf("test-furnished-two", hidden), await viewOf("test-furnished-two-none", hidden)),
    ).toBe(true);
    const shown = `${q}&storeys=storey-ground`;
    const withTable = await viewOf("test-furnished-two", shown);
    const without = await viewOf("test-furnished-two-none", shown);
    expect(near(withTable, furniture, 40)).toBeGreaterThan(near(without, furniture, 40) + 500);
  }, 120_000);

  it("frames a furnishing outside the walls instead of cropping it", async () => {
    const outlying = structuredClone(await model("models/examples/example-cottage"));
    outlying.storeys[0]!.furnishings = [furnishing("sofa-out", "sofa", pt(m(20), m(20)))];
    await publish("test-furnished-out", outlying);
    await publish("test-furnished-out-none", strip(outlying));
    const q = "view=top&labels=0&snapshot=1&style=ifc";
    const withSofa = await viewOf("test-furnished-out", q);
    const without = await viewOf("test-furnished-out-none", q);
    expect(near(without, furniture, 40)).toBeLessThan(50);
    expect(near(withSofa, furniture, 40)).toBeGreaterThan(500);
  }, 120_000);
});

describe("stair readability presentation", () => {
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
