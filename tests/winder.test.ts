/**
 * Winders: the schema's rules, the derived levels and the fan geometry. The checks, IFC and plan
 * sides live with the other stair tests, which share the winder-stair fixture.
 */
import { describe, expect, it } from "vitest";
import winderStair from "./fixtures/winder-stair/index.js";
import { stairLevels, winderFan, winderFrame } from "../src/shared/geometry/stair.js";
import { area } from "../src/shared/geometry/polygon.js";
import { toVec } from "../src/shared/geometry/vec.js";
import { idNodes } from "../src/shared/schema/ids.js";
import { BuildingModelSchema, type BuildingModel, type StairWinder } from "../src/shared/schema/schema.js";
import { mm, pt, stairWinder } from "../src/backend/model/index.js";

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
