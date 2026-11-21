import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage/index.js";
import { checkComponents } from "../src/checks/components.js";
import { windowDivision } from "../src/geometry/window.js";
import { roundTripChecks } from "../src/ifc/roundtrip.js";
import { writeIfc } from "../src/ifc/writer.js";
import { renderPlan } from "../src/render/plan.js";
import { mm } from "../src/model/index.js";
import { BuildingModelSchema, type BuildingModel, type Glazing } from "../src/schema/schema.js";

const sixPanes: Glazing = { columns: [1, 2, 1], rows: [1, 1], barWidth: mm(60) };

/** The cottage with its sash windows given glazing bars. */
function barred(glazing: Glazing): BuildingModel {
  const m = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
  m.components!.windows[0]!.glazing = glazing;
  return m;
}

describe("glazing bars", () => {
  it("divide a window into panes in the given ratios, with bars between and nothing overlapping", () => {
    const { panes, bars } = windowDivision({ width: mm(2500), height: mm(2100) }, { glazing: sixPanes });
    expect(panes).toHaveLength(6);
    expect([...new Set(panes.map((p) => p.w))].sort((a, b) => a - b)).toEqual([595, 1190]); // 1 : 2 : 1 of 2500 − 2 × 60
    expect([...new Set(panes.map((p) => p.h))]).toEqual([1020]); // two equal rows
    // The horizontal bar is centred half way up.
    const horizontal = bars.filter((b) => b.h === 60);
    expect(horizontal.every((b) => b.z + b.h / 2 === 1050)).toBe(true);
    // Two full-height vertical bars, and horizontal bars only between them.
    expect(bars.filter((b) => b.h === 2100)).toHaveLength(2);
    expect(horizontal).toHaveLength(3);
    // No overlaps: the pieces tile the opening exactly.
    const area = [...panes, ...bars].reduce((a, r) => a + r.w * r.h, 0);
    expect(area).toBe(2500 * 2100);
  });

  it("leave a window without them as one pane", () => {
    expect(windowDivision({ width: mm(1200), height: mm(1200) })).toEqual({ panes: [{ x: 0, z: 0, w: 1200, h: 1200 }], bars: [], frame: [] });
  });

  it("must leave room for glass", () => {
    const m = barred({ columns: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], rows: [1], barWidth: mm(60) });
    const issues = checkComponents(m);
    expect(issues.length).toBe(4); // every cottage window is 1200 wide: 20 bars of 60 fill it
    expect(issues[0]).toMatchObject({ level: "ERROR", id: "window-living", message: "1200 mm of bars between 21 panes leave no glass across: the window is only 1200 mm wide" });
  });

  it("sit inside a frame, which lies within the window's size", () => {
    const { frame, panes, bars } = windowDivision({ width: mm(2500), height: mm(2100) }, { frame: { width: mm(100) }, glazing: sixPanes });
    expect(frame).toHaveLength(4);
    // Panes keep their 1:2:1 ratio inside the frame, and the bar is still half way up the window.
    expect([...new Set(panes.map((p) => p.w))].sort((a, b) => a - b)).toEqual([545, 1090]);
    expect(bars.filter((b) => b.h === 60).every((b) => b.z + 30 === 1050)).toBe(true);
    // Frame, panes and bars tile the window exactly: nothing overlaps, nothing sticks out.
    expect([...frame, ...panes, ...bars].reduce((a, r) => a + r.w * r.h, 0)).toBe(2500 * 2100);
    expect(Math.max(...frame.map((r) => r.x + r.w))).toBe(2500);
    expect(Math.max(...frame.map((r) => r.z + r.h))).toBe(2100);
  });

  it("with a frame, must still leave room for glass", () => {
    const m = barred(sixPanes);
    m.components!.windows[0]!.frame = { width: mm(600) };
    expect(checkComponents(m)[0]).toMatchObject({ id: "window-living", message: "1200 mm of frame and 120 mm of bars between 3 panes leave no glass across: the window is only 1200 mm wide" });
  });

  it("are written to IFC as panes and bars whose volumes add up, and every window still meshes", async () => {
    const m = barred(sixPanes);
    const ifc = await writeIfc(m, { fileName: "t.ifc" });
    expect(await roundTripChecks(m, ifc)).toEqual([]);
    // Four windows of six panes and five bars, each a swept solid.
    const text = new TextDecoder().decode(ifc);
    const bodies = [...text.matchAll(/IFCSHAPEREPRESENTATION\([^,]+,'Body','SweptSolid',\(([^)]*)\)\)/g)].map((x) => x[1]!.split(",").length);
    expect(bodies.filter((n) => n === 11)).toHaveLength(4);
  });

  it("show on the plan where the cut passes through them: the vertical bars, and the frame's jambs", () => {
    const m = barred(sixPanes);
    const count = () => (renderPlan(m, m.storeys[0]!, { ids: false }).match(/class="glazing-bar"/g) ?? []).length;
    expect(count()).toBe(4 * 2);
    m.components!.windows[0]!.frame = { width: mm(100) };
    expect(count()).toBe(4 * (2 + 2));
  });

  it("with a frame, still mesh in IFC with the expected volume", async () => {
    const m = barred(sixPanes);
    m.components!.windows[0]!.frame = { width: mm(100) };
    expect(await roundTripChecks(m, await writeIfc(m, { fileName: "t.ifc" }))).toEqual([]);
  });
});
