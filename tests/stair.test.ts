/**
 * Stairs: the schema's segment rules, the derived vertical geometry, the helpers, the checks, the
 * plan symbols and the colour constraints the plan-versus-3D test and the viewer depend on. The IFC
 * side lives in ifc.test.ts, which needs web-ifc.
 */
import { describe, expect, it } from "vitest";
import twoStorey from "../models/example-two-storey/index.js";
import type { Issue } from "../src/checks/issue.js";
import { flightFootprint, flightProfile, flightProfileArea, flightRun, flightTreads, stairLevels, turnBetween } from "../src/geometry/stair.js";
import { m, mm, pt, stair, stairFlight, stairLanding } from "../src/model/index.js";
import { renderFloor, renderPlan, renderWallTops } from "../src/render/plan.js";
import { C } from "../src/render/style.js";
import { checkIds, checkOutlines, checkStairs } from "../src/checks/model.js";
import { BuildingModelSchema, type BuildingModel, type Stair, type StairFlight } from "../src/schema/schema.js";
import { STYLES } from "../src/ifc/styles.js";

const model = (source: unknown = twoStorey): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));

/** The fixture's stair, and the storey it hangs off. */
const stairOf = (m: BuildingModel): Stair => m.storeys[0]!.stairs![0]!;
const mutateStair = (fn: (s: any) => void): BuildingModel => {
  const m = model();
  fn(stairOf(m));
  return m;
};

const ids = (issues: Issue[]) => issues.map((i) => `${i.id}: ${i.message}`);

describe("stair schema", () => {
  it("accepts the fixture's half-turn stair", () => {
    expect(() => model()).not.toThrow();
    expect(stairOf(model()).segments.map((s) => s.kind)).toEqual(["flight", "landing", "flight"]);
  });

  it("accepts a storey with no stairs at all", () => {
    const m = model();
    delete (m.storeys[0] as any).stairs;
    expect(BuildingModelSchema.safeParse(JSON.parse(JSON.stringify(m))).success).toBe(true);
  });

  it("rejects an unknown segment kind", () => {
    const raw: any = JSON.parse(JSON.stringify(twoStorey));
    raw.storeys[0].stairs[0].segments[1].kind = "winder";
    expect(BuildingModelSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects a flight with fewer than two risers", () => {
    const raw: any = JSON.parse(JSON.stringify(twoStorey));
    raw.storeys[0].stairs[0].segments[0].risers = 1;
    expect(BuildingModelSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects fractional risers", () => {
    const raw: any = JSON.parse(JSON.stringify(twoStorey));
    raw.storeys[0].stairs[0].segments[0].risers = 8.5;
    expect(BuildingModelSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects a landing outline of two points", () => {
    const raw: any = JSON.parse(JSON.stringify(twoStorey));
    raw.storeys[0].stairs[0].segments[1].outline = [{ x: 0, y: 0 }, { x: 1000, y: 0 }];
    expect(BuildingModelSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects a stair with no segments", () => {
    const raw: any = JSON.parse(JSON.stringify(twoStorey));
    raw.storeys[0].stairs[0].segments = [];
    expect(BuildingModelSchema.safeParse(raw).success).toBe(false);
  });
});

describe("stair helpers", () => {
  it("stair() records the destination storey's id and keeps the segment order", () => {
    const first: any = { id: "storey-first", name: "First", elevation: 3050, walls: [], openings: [], slabs: [], rooms: [] };
    const lower = stairFlight("stair-flight-lower", pt(mm(0), mm(0)), pt(m(2), mm(0)), { width: mm(800), risers: 8 });
    const landing = stairLanding("stair-landing-half", [pt(m(2), mm(0)), pt(m(3), mm(0)), pt(m(3), m(1))], { thickness: mm(150) });
    const upper = stairFlight("stair-flight-upper", pt(m(3), m(1)), pt(m(1), m(1)), { width: mm(800), risers: 8 });
    const s = stair("stair-main", first, [lower, landing, upper]);
    expect(s.toStoreyId).toBe("storey-first");
    expect(s.segments).toEqual([lower, landing, upper]);
  });

  it("stairFlight and stairLanding build plain values", () => {
    expect(stairFlight("f", pt(mm(1), mm(2)), pt(mm(3), mm(4)), { width: mm(825), risers: 8 })).toEqual({
      kind: "flight",
      id: "f",
      start: { x: 1, y: 2 },
      end: { x: 3, y: 4 },
      width: 825,
      risers: 8,
    });
    const outline = [pt(mm(0), mm(0)), pt(m(1), mm(0)), pt(m(1), m(1))];
    expect(stairLanding("l", outline, { thickness: mm(150) })).toEqual({ kind: "landing", id: "l", outline, thickness: 150 });
  });
});

describe("derived stair geometry", () => {
  it("divides the rise between every riser, fractionally", () => {
    const levels = stairLevels(stairOf(model()), 3050);
    expect(levels.riser).toBeCloseTo(190.625, 9);
    expect(levels.totalRisers).toBe(16);
    const [lower, landing, upper] = levels.segments;
    expect(lower).toMatchObject({ kind: "flight", base: 0, top: 1525 });
    expect(landing).toMatchObject({ kind: "landing", level: 1525 });
    expect(upper).toMatchObject({ kind: "flight", base: 1525, top: 3050 });
  });

  it("reaches the target storey with an uneven riser split", () => {
    const m = mutateStair((s) => {
      s.segments[0].risers = 9;
      s.segments[2].risers = 7;
    });
    const levels = stairLevels(stairOf(m), 3050);
    expect(levels.riser).toBeCloseTo(190.625, 9);
    expect(levels.segments[1]).toMatchObject({ level: 1715.625 }); // 9 risers up
    expect(levels.segments[2]).toMatchObject({ kind: "flight", base: 1715.625, top: 3050 });
  });

  it("derives the going from the plan run and one fewer tread", () => {
    const s = stairOf(model());
    expect(flightRun(s.segments[0] as StairFlight)).toBe(1800);
    expect(stairLevels(s, 3050).segments[0]).toMatchObject({ kind: "flight", run: 1800, going: 1800 / 7 });
  });

  it("gives a flight's profile the stepped area less the tapered soffit", () => {
    const levels = stairLevels(stairOf(model()), 3050);
    const lower = levels.segments[0]!;
    expect(lower.kind).toBe("flight");
    if (lower.kind !== "flight") return;
    const rise = lower.top - lower.base;
    const topFar = rise - levels.riser; // the last riser belongs to the segment above
    const expected = (lower.run * rise) / 2 - (lower.run * (topFar - 150)) / 2;
    expect(flightProfileArea(lower.segment, lower.going, levels.riser)).toBeCloseTo(expected, 6);
  });

  it("steps a profile up one riser at a time and closes it along a tapered soffit", () => {
    const f = stairFlight("f", pt(mm(0), mm(0)), pt(mm(20), mm(0)), { width: mm(800), risers: 3 });
    // run 20, 2 treads of 10, risers of 5, waist 2
    expect(flightProfile(f, 10, 5, 2)).toEqual([
      { x: 20, y: 8 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
      { x: 0, y: 0 },
    ]);
  });

  it("centres a footprint on the start-to-end line, whichever way the flight runs", () => {
    const east = stairFlight("a", pt(mm(0), mm(0)), pt(m(2), mm(0)), { width: mm(800), risers: 4 });
    expect(flightFootprint(east).map((p) => [p.x, p.y])).toEqual([
      [0, -400],
      [2000, -400],
      [2000, 400],
      [0, 400],
    ]);
    const west = stairFlight("b", pt(m(2), mm(0)), pt(mm(0), mm(0)), { width: mm(800), risers: 4 });
    expect(flightFootprint(west).map((p) => [p.x, p.y])).toEqual([
      [2000, 400],
      [0, 400],
      [0, -400],
      [2000, -400],
    ]);
  });

  it("draws one tread line per tread, not per riser", () => {
    const f = stairFlight("f", pt(mm(0), mm(0)), pt(m(2), mm(0)), { width: mm(800), risers: 8 });
    const treads = flightTreads(f, 2000 / 7);
    expect(treads).toHaveLength(7);
    expect(treads[0]!.from.x).toBeCloseTo(2000 / 7, 9);
    expect(treads[6]!.to.x).toBe(2000);
  });

  it("measures the turn between consecutive flights", () => {
    const east = stairFlight("a", pt(mm(0), mm(0)), pt(m(2), mm(0)), { width: mm(800), risers: 4 });
    const west = stairFlight("b", pt(m(2), m(1)), pt(mm(0), m(1)), { width: mm(800), risers: 4 });
    const north = stairFlight("c", pt(mm(0), mm(0)), pt(mm(0), m(2)), { width: mm(800), risers: 4 });
    const diagonal = stairFlight("d", pt(mm(0), mm(0)), pt(m(2), m(2)), { width: mm(800), risers: 4 });
    expect(turnBetween(east, east)).toBeCloseTo(0, 9);
    expect(turnBetween(east, north)).toBeCloseTo(90, 9);
    expect(turnBetween(east, west)).toBeCloseTo(180, 9);
    expect(turnBetween(east, diagonal)).toBeCloseTo(45, 9);
  });
});

describe("stair checks", () => {
  it("accepts the fixture's stair", () => {
    expect(checkStairs(model())).toEqual([]);
    expect(checkIds(model())).toEqual([]);
    expect(checkOutlines(model())).toEqual([]);
  });

  it("rejects a target storey that is not in the model", () => {
    const m = mutateStair((s) => (s.toStoreyId = "storey-second"));
    expect(ids(checkStairs(m)).join()).toMatch(/stair-main: toStoreyId storey-second is not a storey/);
  });

  it("rejects a stair that targets its own storey", () => {
    const m = mutateStair((s) => (s.toStoreyId = "storey-ground"));
    expect(ids(checkStairs(m)).join()).toMatch(/stair-main: toStoreyId is its own storey/);
  });

  it("rejects a target below its own storey", () => {
    const m = model();
    m.storeys[1]!.elevation = mm(-100);
    expect(ids(checkStairs(m)).join()).toMatch(/stair-main: toStoreyId storey-first is at -100 mm/);
  });

  it("rejects a stair that skips a storey", () => {
    const m = model();
    m.storeys.push({ ...m.storeys[1]!, id: "storey-second", name: "Second floor", elevation: mm(6100) });
    stairOf(m).toStoreyId = "storey-second";
    expect(ids(checkStairs(m)).join()).toMatch(/stair-main: toStoreyId storey-second skips storey-first, the next storey up/);
  });

  it("rejects a stair that starts or ends with a landing", () => {
    const start = mutateStair((s) => s.segments.unshift({ ...s.segments[1] }));
    expect(ids(checkStairs(start)).join()).toMatch(/the first segment is a landing/);
    const end = mutateStair((s) => s.segments.push({ ...s.segments[1] }));
    expect(ids(checkStairs(end)).join()).toMatch(/the last segment is a landing/);
  });

  it("rejects two landings in a row", () => {
    const m = mutateStair((s) => s.segments.splice(2, 0, { ...s.segments[1], id: "stair-landing-second" }));
    expect(ids(checkStairs(m)).join()).toMatch(/stair-main: stair-landing-second is a landing straight after stair-landing-half/);
  });

  it("rejects a flight with no plan run", () => {
    const m = mutateStair((s) => (s.segments[0].end = { ...s.segments[0].start }));
    expect(ids(checkStairs(m)).join()).toMatch(/stair-main: flight stair-flight-lower has no plan run/);
  });

  it("rejects a landing its flights miss", () => {
    const m = mutateStair((s) => (s.segments[1].outline = s.segments[1].outline.map((p: any) => ({ x: p.x + 100, y: p.y }))));
    const found = ids(checkStairs(m)).filter((i) => i.startsWith("stair-landing-half"));
    expect(found).toHaveLength(2);
    expect(found.join()).toMatch(/stair-flight-lower ends 100 mm away from this landing/);
    expect(found.join()).toMatch(/stair-flight-upper starts 100 mm away from this landing/);
  });

  it("accepts a landing its flights meet within a millimetre", () => {
    const m = mutateStair((s) => (s.segments[1].outline = s.segments[1].outline.map((p: any) => ({ x: p.x + 0.5, y: p.y }))));
    expect(checkStairs(m)).toEqual([]);
  });

  it("rejects a self-intersecting landing outline", () => {
    const m = mutateStair((s) =>
      (s.segments[1].outline = [pt(mm(4400), mm(1000)), pt(mm(5200), mm(2600)), pt(mm(5200), mm(1000)), pt(mm(4400), mm(2600))]),
    );
    expect(ids(checkOutlines(m)).join()).toMatch(/stair-landing-half: outline crosses itself/);
  });

  it("reports a stair flight id shared with a wall, naming both kinds", () => {
    const m = mutateStair((s) => (s.segments[0].id = "wall-south"));
    expect(ids(checkIds(m)).join()).toMatch(/wall-south: id is used by a wall and a stair flight/);
  });

  it("reports two landings that share an id", () => {
    const m = mutateStair((s) => s.segments.splice(2, 0, { ...s.segments[1] }));
    expect(ids(checkIds(m)).join()).toMatch(/stair-landing-half: id is used by two stair landings/);
  });
});

describe("stair plan symbols", () => {
  const svg = (ids: boolean) => renderPlan(model(), model().storeys[0]!, { ids });

  it("draws a group per stair, flight and landing", () => {
    const out = svg(false);
    expect(out).toContain('class="stair" data-id="stair-main"');
    expect(out).toContain('class="stair-flight" data-id="stair-flight-lower"');
    expect(out).toContain('class="stair-landing" data-id="stair-landing-half"');
    expect(out).toContain('class="stair-flight" data-id="stair-flight-upper"');
    expect(out.match(/class="stair-flight"/g)).toHaveLength(2);
    expect(out.match(/class="stair-landing"/g)).toHaveLength(1);
  });

  it("draws a tread line per tread and an arrow per flight", () => {
    const out = svg(false);
    expect(out.match(/stroke="#5c8a55"/g)).toHaveLength(19); // 2 footprints + 1 landing + 14 treads + 2 arrow shafts
    expect(out.match(/fill="#5c8a55"/g)).toHaveLength(2); // the two arrowheads
  });

  it("labels stair, flight and landing ids only with --ids", () => {
    expect(svg(true)).toContain(">stair-main<");
    expect(svg(true)).toContain(">stair-flight-upper<");
    expect(svg(true)).toContain(">stair-landing-half<");
    expect(svg(false)).not.toContain(">stair-main<");
  });

  it("draws stairs last, after the walls and openings", () => {
    const out = svg(false);
    expect(out.indexOf('class="wall"')).toBeLessThan(out.indexOf('class="stair"'));
    expect(out.indexOf('class="stair"')).toBeLessThan(out.indexOf("Hall"));
  });

  it("includes a stair outside every room and slab in the drawing extent", () => {
    const outside = model();
    const shift = 20000; // 20 m east of everything else
    for (const seg of stairOf(outside).segments) {
      if (seg.kind === "flight") {
        seg.start = pt(mm(seg.start.x + shift), mm(seg.start.y));
        seg.end = pt(mm(seg.end.x + shift), mm(seg.end.y));
      } else {
        seg.outline = seg.outline.map((p) => pt(mm(p.x + shift), mm(p.y)));
      }
    }
    // The overall east–west dimension reports the drawing extent, which the stair now sets.
    expect(renderPlan(model(), model().storeys[0]!, { ids: false })).toContain(">6000<");
    expect(renderPlan(outside, outside.storeys[0]!, { ids: false })).toContain(">25200<");
  });

  it("keeps stairs out of the overlays the viewer composites", () => {
    const m = model();
    for (const out of [renderFloor(m.storeys[0]!).svg, renderWallTops(m.storeys[0]!, m.components).svg]) {
      expect(out).not.toContain("stair");
    }
  });

  it("draws a stair on the storey that contains it only", () => {
    const m = model();
    expect(renderPlan(m, m.storeys[1]!, { ids: false })).not.toContain('class="stair"');
  });
});

describe("stair colours", () => {
  /** sRGB to linear, as three.js does it, which is the space the viewer compares colours in. */
  const toLinear = (c: number) => (c < 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  it("keeps the plan colour clear of wall, room and paper, which the comparison classifies", () => {
    for (const name of ["wall", "room", "paper"] as const) {
      const a = hex(C.stair);
      const b = hex(C[name]);
      for (let i = 0; i < 3; i++) expect(Math.abs(a[i]! - b[i]!), `${name} channel ${i}`).toBeGreaterThan(5);
    }
  });

  it("keeps the IFC colour far enough from every other style that the viewer leaves it alone", () => {
    const stair = STYLES.stair.rgb.map(toLinear);
    for (const [name, { rgb }] of Object.entries(STYLES)) {
      if (name === "stair") continue;
      const other = rgb.map(toLinear);
      const d = Math.hypot(stair[0]! - other[0]!, stair[1]! - other[1]!, stair[2]! - other[2]!);
      expect(d, name).toBeGreaterThanOrEqual(0.02);
    }
  });
});
