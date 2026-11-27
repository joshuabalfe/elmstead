/**
 * Winders: the schema's rules, the derived levels and the fan geometry. The checks, IFC and plan
 * sides live with the other stair tests, which share the winder-stair fixture.
 */
import { describe, expect, it } from "vitest";
import winderStair from "./fixtures/winder-stair/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import elmstead from "../models/elmstead/index.js";
import cottage from "../models/examples/example-cottage/index.js";
import { stairBandRiser } from "../src/frontend/scene/stair-bands.js";
import { stairLevels, winderFan, winderFrame } from "../src/shared/geometry/stair.js";
import { area } from "../src/shared/geometry/polygon.js";
import { toVec } from "../src/shared/geometry/vec.js";
import { idNodes } from "../src/shared/schema/ids.js";
import { BuildingModelSchema, type BuildingModel, type StairWinder } from "../src/shared/schema/schema.js";
import { addTo, mm, pt, remove, replace, revise, stairWinder } from "../src/backend/model/index.js";
import { diffModels } from "../src/shared/diff/index.js";
import { checkModel, checkOutlines } from "../src/backend/checks/model.js";
import { renderFloor, renderPlan, renderWallTops } from "../src/shared/render/plan.js";

const raw = (): any => JSON.parse(JSON.stringify(winderStair));
const model = (source: unknown = winderStair): BuildingModel =>
  BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));
const stairOf = (m: BuildingModel) => m.storeys[0]!.stairs![0]!;
const winderOf = (m: BuildingModel = model()): StairWinder => {
  const w = stairOf(m).segments[0]!;
  if (w.kind !== "winder") throw new Error("the fixture's first segment should be a winder");
  return w;
};

/** A square or rectangular winder at the origin: pivot south-west, entry north-west, exit south-east. */
const block = (w: number, d: number, risers: number): StairWinder =>
  stairWinder("w", [pt(mm(0), mm(0)), pt(mm(w), mm(0)), pt(mm(w), mm(d)), pt(mm(0), mm(d))], {
    pivot: pt(mm(0), mm(0)),
    entry: pt(mm(0), mm(d)),
    risers,
  });

describe("winder schema", () => {
  it("accepts a winder followed by a flight", () => {
    expect(() => model()).not.toThrow();
    expect(stairOf(model()).segments.map((s) => s.kind)).toEqual(["winder", "flight"]);
  });

  it("rejects a winder with one riser", () => {
    const r = raw();
    r.storeys[0].stairs[0].segments[0].risers = 1;
    expect(BuildingModelSchema.safeParse(r).success).toBe(false);
  });

  it("rejects a winder outline of two points", () => {
    const r = raw();
    r.storeys[0].stairs[0].segments[0].outline = r.storeys[0].stairs[0].segments[0].outline.slice(0, 2);
    expect(BuildingModelSchema.safeParse(r).success).toBe(false);
  });

  it("rejects a winder with no pivot or no entry", () => {
    for (const key of ["pivot", "entry"]) {
      const r = raw();
      delete r.storeys[0].stairs[0].segments[0][key];
      expect(BuildingModelSchema.safeParse(r).success, key).toBe(false);
    }
  });

  it("rejects fields a winder does not have", () => {
    const r = raw();
    r.storeys[0].stairs[0].segments[0].thickness = 150;
    expect(BuildingModelSchema.safeParse(r).success).toBe(false);
  });
});

describe("winder ids", () => {
  it("lists a winder as a stair winder on its storey, with no place of its own", () => {
    const node = idNodes(model()).find((n) => n.element.id === "stair-winder-turn")!;
    expect(node).toMatchObject({ kind: "stair winder", storey: "storey-ground" });
    expect("place" in node).toBe(false);
  });
});

describe("winder levels", () => {
  it("shares the rise across the winder's and the flight's risers", () => {
    const levels = stairLevels(stairOf(model()), 2750);
    expect(levels.totalRisers).toBe(11);
    expect(levels.riser).toBe(250);
    expect(levels.segments[0]).toMatchObject({ kind: "winder", base: 0, top: 750 });
    expect(levels.segments[1]).toMatchObject({ kind: "flight", base: 750, top: 2750, going: 250 });
  });

  it("gives 200 mm risers over 2200 mm for a winder of 3 and a flight of 8", () => {
    const levels = stairLevels(stairOf(model()), 2200);
    expect(levels.riser).toBe(200);
    expect(levels.segments[0]).toMatchObject({ top: 600 });
    expect(levels.segments[1]).toMatchObject({ base: 600 });
  });
});

describe("winder fan", () => {
  it("reads the fixture's outline against its pivot and entry", () => {
    const frame = winderFrame(winderOf());
    if (typeof frame === "string") throw new Error(frame);
    expect(frame.pivot).toEqual({ x: 3100, y: 3900 });
    expect(frame.entry).toEqual({ x: 3100, y: 4800 });
    expect(frame.exit).toEqual({ x: 4000, y: 3900 });
    expect(frame.turn).toBeCloseTo(90, 9);
    expect(frame.sign).toBe(-1); // north to east is a right turn
  });

  it("fans a square into three treads with lines at 30° and 60° from the entry edge", () => {
    const fan = winderFan(winderOf());
    expect(fan.rays).toHaveLength(2);
    const [a, b] = fan.rays.map((r) => r.to);
    // 900 mm square, pivot south-west: the 30° line meets the north edge, the 60° line the east edge.
    expect(a!.y).toBeCloseTo(4800, 6);
    expect(a!.x).toBeCloseTo(3100 + 900 * Math.tan((30 * Math.PI) / 180), 6);
    expect(b!.x).toBeCloseTo(4000, 6);
    expect(b!.y).toBeCloseTo(3900 + 900 * Math.tan((30 * Math.PI) / 180), 6);
  });

  it("cuts the outline exactly into its treads, the middle one holding the far corner", () => {
    const w = winderOf();
    const fan = winderFan(w);
    expect(fan.treads.map((t) => t.length)).toEqual([3, 4, 3]);
    expect(fan.treads.reduce((n, t) => n + area(t), 0)).toBeCloseTo(area(w.outline.map(toVec)), 3);
    expect(fan.treads[1]).toContainEqual({ x: 4000, y: 4800 });
  });

  it("cuts a rectangle and a left-turning winder just as exactly", () => {
    const rect = block(1200, 700, 4);
    expect(winderFan(rect).treads.reduce((n, t) => n + area(t), 0)).toBeCloseTo(1200 * 700, 3);
    // Swap entry and exit: the same block now turns the other way.
    const left = stairWinder("w", rect.outline, { pivot: rect.pivot, entry: pt(mm(1200), mm(0)), risers: 4 });
    const fan = winderFan(left);
    expect(fan.frame.sign).toBe(1);
    expect(fan.treads.reduce((n, t) => n + area(t), 0)).toBeCloseTo(1200 * 700, 3);
  });

  it("shares a corner when a fan line ends exactly on it", () => {
    // Two risers on a square: the one fan line is the diagonal, which ends on the far corner.
    const fan = winderFan(block(900, 900, 2));
    expect(fan.treads).toHaveLength(2);
    for (const t of fan.treads) {
      expect(t).toHaveLength(3);
      expect(t.some((p) => Math.abs(p.x - 900) < 1e-6 && Math.abs(p.y - 900) < 1e-6)).toBe(true);
    }
  });

  it("runs the walking line from the entry edge's middle to the exit edge's middle", () => {
    const line = winderFan(winderOf()).walkingLine;
    expect(line).toHaveLength(4); // entry edge, two fan lines, exit edge
    expect(line[0]).toEqual({ x: 3100, y: 4350 });
    expect(line[3]).toEqual({ x: 3550, y: 3900 });
  });

  it("says why an outline cannot be read, rather than guessing", () => {
    const off = stairWinder("w", block(900, 900, 3).outline, {
      pivot: pt(mm(50), mm(50)),
      entry: pt(mm(0), mm(900)),
      risers: 3,
    });
    expect(winderFrame(off)).toMatch(/pivot is not one of the outline/);
    const far = stairWinder("w", block(900, 900, 3).outline, {
      pivot: pt(mm(0), mm(0)),
      entry: pt(mm(900), mm(900)),
      risers: 3,
    });
    expect(winderFrame(far)).toMatch(/entry is not beside the pivot/);
    expect(() => winderFan(far)).toThrow(/entry is not beside the pivot/);
  });
});

describe("stairWinder helper", () => {
  it("records the outline, pivot, entry and risers as given", () => {
    const outline = [pt(mm(0), mm(0)), pt(mm(900), mm(0)), pt(mm(900), mm(900)), pt(mm(0), mm(900))];
    const w = stairWinder("stair-winder-turn", outline, { pivot: outline[0]!, entry: outline[3]!, risers: 3 });
    expect(w).toEqual({
      kind: "winder",
      id: "stair-winder-turn",
      outline,
      pivot: outline[0],
      entry: outline[3],
      risers: 3,
    });
  });

  it("checks nothing: a pivot off the outline is built as given and left to the checks", () => {
    const w = block(900, 900, 3);
    expect(() => stairWinder("w", w.outline, { pivot: pt(mm(5), mm(5)), entry: w.entry, risers: 3 })).not.toThrow();
  });

  it("builds a stair of a winder then a flight, in the order given", () => {
    const stair = model().storeys[0]!.stairs![0]!;
    expect(stair.toStoreyId).toBe("storey-first");
    expect(stair.segments.map((s) => s.id)).toEqual(["stair-winder-turn", "stair-flight-main"]);
  });
});

describe("winder checks", () => {
  const mutate = (fn: (stair: any) => void): BuildingModel => {
    const r = raw();
    fn(r.storeys[0].stairs[0]);
    return model(r);
  };
  const errors = (m: BuildingModel) => checkModel(m).filter((i) => i.level === "ERROR");
  const about = (m: BuildingModel, id: string) => errors(m).filter((i) => i.id === id);
  const SW = { x: 3100, y: 3900 };
  const SE = { x: 4000, y: 3900 };
  const NE = { x: 4000, y: 4800 };
  const NW = { x: 3100, y: 4800 };

  it("passes the fixture, a winder then a flight", () => {
    expect(errors(model())).toEqual([]);
  });

  it("reports a winder and a flight sharing an id, naming both kinds", () => {
    const m = mutate((s) => (s.segments[1].id = "stair-winder-turn"));
    expect(errors(m).map((i) => `${i.id}: ${i.message}`)).toContain(
      "stair-winder-turn: id is used by a stair winder and a stair flight",
    );
  });

  it("rejects a winder after a flight and a landing", () => {
    const m = mutate((s) => {
      const [winder, flight] = s.segments;
      s.segments = [
        flight,
        { kind: "landing", id: "stair-landing-x", outline: winder.outline, thickness: 150 },
        winder,
      ];
    });
    expect(
      about(m, "stair-main")
        .map((i) => i.message)
        .join("\n"),
    ).toMatch(/winder must be the first segment/);
  });

  it("rejects a winder that is the last segment", () => {
    const m = mutate((s) => s.segments.pop());
    expect(
      about(m, "stair-main")
        .map((i) => i.message)
        .join("\n"),
    ).toMatch(/must be followed by one/);
  });

  it("rejects a pivot off the outline and an entry not beside the pivot", () => {
    expect(
      about(
        mutate((s) => (s.segments[0].pivot = { x: 3000, y: 3900 })),
        "stair-winder-turn",
      )[0]!.message,
    ).toMatch(/pivot is not one of the outline's points/);
    expect(
      about(
        mutate((s) => (s.segments[0].entry = NE)),
        "stair-winder-turn",
      )[0]!.message,
    ).toMatch(/entry is not beside the pivot/);
  });

  it("rejects a concave outline and a point in a line", () => {
    const concave = mutate((s) => (s.segments[0].outline = [SW, SE, { x: 3550, y: 4300 }, NE, NW]));
    expect(
      about(concave, "stair-winder-turn")
        .map((i) => i.message)
        .join("\n"),
    ).toMatch(/not strictly convex/);
    const inLine = mutate((s) => (s.segments[0].outline = [SW, { x: 3550, y: 3900 }, SE, NE, NW]));
    expect(about(inLine, "stair-winder-turn").length).toBeGreaterThan(0);
  });

  it("applies the usual outline checks to a winder", () => {
    const repeated = mutate((s) => (s.segments[0].outline = [SW, SE, NE, NE, NW]));
    expect(checkOutlines(repeated).some((i) => i.id === "stair-winder-turn")).toBe(true);
  });

  it("rejects a flight that misses, overhangs or runs back into the exit edge", () => {
    const flight = (s: any) => s.segments[1];
    const missed = mutate((s) => {
      flight(s).start.y -= 100;
      flight(s).end.y -= 100;
    });
    expect(about(missed, "stair-winder-turn")[0]!.message).toMatch(/starts 100 mm from this winder's exit edge/);
    const wide = mutate((s) => (flight(s).width = 1100));
    expect(about(wide, "stair-winder-turn")[0]!.message).toMatch(/wider than this winder's exit edge/);
    const back = mutate((s) => (flight(s).end = { x: 3550, y: 5650 }));
    expect(about(back, "stair-winder-turn")[0]!.message).toMatch(/runs back into this winder/);
  });

  it("accepts a flight narrower than the exit edge, and one as wide as it", () => {
    expect(errors(mutate((s) => (s.segments[1].width = 600)))).toEqual([]);
    expect(errors(mutate((s) => (s.segments[1].width = 900)))).toEqual([]);
  });
});

describe("winders in revisions and the diff", () => {
  const stairNow = (m: BuildingModel) => m.storeys[0]!.stairs![0]!;
  const withRisers = (m: BuildingModel, risers: number) => {
    const s = structuredClone(stairNow(m));
    (s.segments[0] as StairWinder).risers = risers;
    return s;
  };

  it("replaces a stair with a winder whole, and the diff reports the stair as changed", () => {
    const b = model();
    const r = revise(b, [replace(withRisers(b, 4))]);
    expect((stairNow(r).segments[0] as StairWinder).risers).toBe(4);
    expect((stairNow(b).segments[0] as StairWinder).risers).toBe(3);
    expect(diffModels(b, r).changed).toEqual([{ id: "stair-main", kind: "stair", storey: "storey-ground" }]);
  });

  it("removes a stair with a winder, and adds it back to a model without one", () => {
    const b = model();
    const without = revise(b, [remove("stair-main")]);
    expect(without.storeys[0]!.stairs ?? []).toEqual([]);
    expect(diffModels(b, without).removed).toEqual([{ id: "stair-main", kind: "stair", storey: "storey-ground" }]);
    const back = revise(without, [addTo("storey-ground", { stairs: [stairNow(b)] })]);
    expect(diffModels(without, back).added).toEqual([{ id: "stair-main", kind: "stair", storey: "storey-ground" }]);
    expect(checkModel(back).filter((i) => i.level === "ERROR")).toEqual([]);
  });

  it("will not edit a winder on its own, and says to replace its stair", () => {
    const b = model();
    const winder = stairNow(b).segments[0]!;
    expect(() => revise(b, [replace(winder as never)])).toThrow(/stair winder.*replace its stair/);
    expect(() => revise(b, [remove("stair-winder-turn")])).toThrow(/replace its stair/);
  });
});

describe("winder plan symbols", () => {
  const plan = (m: BuildingModel = model(), storey = 0, ids = false) => renderPlan(m, m.storeys[storey]!, { ids });

  it("draws a winder group beside its flight, inside the stair's group", () => {
    const out = plan();
    expect(out).toContain('class="stair" data-id="stair-main"');
    expect(out).toContain('class="stair-winder" data-id="stair-winder-turn"');
    expect(out).toContain('class="stair-flight" data-id="stair-flight-main"');
    expect(out.match(/class="stair-winder"/g)).toHaveLength(1);
    expect(out.indexOf('class="stair" ')).toBeLessThan(out.indexOf('class="stair-winder"'));
  });

  it("draws the winder's outline, a line on each interior fan line and an arrow", () => {
    const out = plan();
    const winder = out.slice(out.indexOf('class="stair-winder"'), out.indexOf('class="stair-flight"'));
    expect(winder.match(/<polygon[^>]*stroke="#5c8a55"/g)).toHaveLength(1); // the outline
    expect(winder.match(/<line[^>]*stroke="#5c8a55"/g)).toHaveLength(2); // two fan lines for three risers
    expect(winder.match(/<polyline/g)).toHaveLength(1); // the walking line
    expect(winder.match(/fill="#5c8a55"/g)).toHaveLength(1); // its arrowhead
  });

  it("draws one arrow per segment: the winder's and the flight's", () => {
    const out = plan();
    expect(out.match(/fill="#5c8a55"/g)).toHaveLength(2);
    // 1 outline, 2 fan lines, 1 walking line; 1 footprint, 7 tread lines, 1 arrow shaft.
    expect(out.match(/stroke="#5c8a55"/g)).toHaveLength(13);
  });

  it("labels the winder's id only with --ids", () => {
    expect(plan(model(), 0, true)).toContain(">stair-winder-turn<");
    expect(plan(model(), 0, false)).not.toContain(">stair-winder-turn<");
  });

  it("includes a winder outside every room and slab in the drawing extent", () => {
    const outside = model();
    const shift = 20000;
    for (const seg of stairOf(outside).segments) {
      if (seg.kind === "flight") {
        seg.start = pt(mm(seg.start.x + shift), mm(seg.start.y));
        seg.end = pt(mm(seg.end.x + shift), mm(seg.end.y));
      } else if (seg.kind === "winder") {
        seg.outline = seg.outline.map((p) => pt(mm(p.x + shift), mm(p.y)));
        seg.pivot = pt(mm(seg.pivot.x + shift), mm(seg.pivot.y));
        seg.entry = pt(mm(seg.entry.x + shift), mm(seg.entry.y));
      }
    }
    expect(plan()).toContain(">4200<");
    expect(plan(outside)).toContain(">24000<"); // from the walls' west face to the winder's east edge
  });

  it("keeps the winder out of the overlays the viewer composites, and off other storeys", () => {
    const m = model();
    for (const out of [renderFloor(m.storeys[0]!).svg, renderWallTops(m.storeys[0]!, m.components).svg])
      expect(out).not.toContain("stair");
    expect(plan(m, 1)).not.toContain("stair-winder");
  });

  it("draws the same plan every time, and matches the committed reference drawing", async () => {
    expect(plan()).toBe(plan());
    await expect(plan()).toMatchFileSnapshot("__snapshots__/winder-stair.storey-ground.plan.svg");
  });
});

describe("the viewer's stair band riser", () => {
  /** What the engine computed before winders: the rise over the flights' risers alone. */
  const before = (m: BuildingModel): number => {
    let riser = 0;
    for (const s of m.storeys)
      for (const st of s.stairs ?? []) {
        const to = m.storeys.find((x) => x.id === st.toStoreyId);
        const total = st.segments.reduce((n, g) => (g.kind === "flight" ? n + g.risers : n), 0);
        if (to && total > 0) riser = Math.max(riser, (to.elevation - s.elevation) / total / 1000);
      }
    return riser;
  };

  it("counts a winder's risers with the flight's: 250 mm over 3 + 8 risers, not 344 mm over 8", () => {
    expect(stairBandRiser(model())).toBe(0.25);
  });

  it("gives 200 mm for 2200 mm over a winder of 3 and a flight of 8", () => {
    const m = model();
    m.storeys[1]!.elevation = mm(2200);
    expect(stairBandRiser(m)).toBe(0.2);
  });

  it("is what it was for stairs of flights and landings, including a top landing", () => {
    for (const source of [twoStorey, elmstead]) {
      const m = model(source);
      expect(stairBandRiser(m)).toBeGreaterThan(0);
      expect(stairBandRiser(m)).toBe(before(m));
    }
  });

  it("is zero with no stairs or no model", () => {
    expect(stairBandRiser(null)).toBe(0);
    expect(stairBandRiser(model(cottage))).toBe(0);
  });
});
