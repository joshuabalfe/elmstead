import { describe, expect, it } from "vitest";
import {
  FURNISHING_DEFAULT_SIZE,
  FURNISHING_IFC,
  furnishingFootprint,
  furnishingGeometry,
  furnishingParts,
  furnishingSize,
  partFootprint,
  partVolume,
  visibleParts,
  type FurnishingPart,
  type FurnishingSize,
} from "../src/shared/geometry/furnishing.js";
import { bounds } from "../src/shared/geometry/polygon.js";
import { deg, furnishing, mm, pt } from "../src/backend/model/index.js";
import { FURNISHING_KINDS, type FurnishingKind } from "../src/shared/schema/schema.js";

const EPS = 1e-6;
const tiny: FurnishingSize = { width: 10, depth: 10, height: 10 };

/** Whether two boxes share volume; boxes that only touch do not. */
const overlap = (a: FurnishingPart, b: FurnishingPart): boolean =>
  a.x < b.x + b.width - EPS &&
  b.x < a.x + a.width - EPS &&
  a.y < b.y + b.depth - EPS &&
  b.y < a.y + a.depth - EPS &&
  a.z < b.z + b.height - EPS &&
  b.z < a.z + a.height - EPS;

const roles = (parts: FurnishingPart[]) => parts.map((p) => p.role);

describe("furnishing parts", () => {
  for (const [label, size] of [
    ["default", undefined],
    ["tiny", tiny],
  ] as const) {
    describe(`at the ${label} size`, () => {
      for (const kind of FURNISHING_KINDS) {
        const s = size ?? FURNISHING_DEFAULT_SIZE[kind];
        const parts = furnishingParts(kind, s);

        it(`${kind}: parts are positive, do not overlap and fill the overall size`, () => {
          expect(parts.length).toBeGreaterThan(0);
          for (const p of parts) {
            expect(p.width, `${p.role} width`).toBeGreaterThan(0);
            expect(p.depth, `${p.role} depth`).toBeGreaterThan(0);
            expect(p.height, `${p.role} height`).toBeGreaterThan(0);
          }
          parts.forEach((a, i) =>
            parts.slice(i + 1).forEach((b) => expect(overlap(a, b), `${a.role}/${b.role}`).toBe(false)),
          );
          const min = (f: (p: FurnishingPart) => number) => Math.min(...parts.map(f));
          const max = (f: (p: FurnishingPart) => number) => Math.max(...parts.map(f));
          expect(min((p) => p.x)).toBeCloseTo(-s.width / 2, 9);
          expect(max((p) => p.x + p.width)).toBeCloseTo(s.width / 2, 9);
          expect(min((p) => p.y)).toBeCloseTo(-s.depth / 2, 9);
          expect(max((p) => p.y + p.depth)).toBeCloseTo(s.depth / 2, 9);
          expect(min((p) => p.z)).toBeCloseTo(0, 9);
          expect(max((p) => p.z + p.height)).toBeCloseTo(s.height, 9);
        });
      }
    });
  }

  it("covers every kind with a default size and an IFC mapping", () => {
    expect(Object.keys(FURNISHING_DEFAULT_SIZE).sort()).toEqual([...FURNISHING_KINDS].sort());
    expect(Object.keys(FURNISHING_IFC).sort()).toEqual([...FURNISHING_KINDS].sort());
  });

  it("maps each kind to the IFC4 class and predefined type", () => {
    const sanitary = FURNISHING_KINDS.filter((k) => FURNISHING_IFC[k].class === "sanitary");
    expect(sanitary).toEqual(["bath", "shower", "sink", "toilet", "wash-basin"]);
    expect(FURNISHING_IFC["file-cabinet"].predefined).toBe("FILECABINET");
    expect(FURNISHING_IFC.toilet.predefined).toBe("TOILETPAN");
    expect(FURNISHING_IFC["wash-basin"].predefined).toBe("WASHHANDBASIN");
  });

  it("gives a chair a seat, a back and four legs, not a block", () => {
    const parts = furnishingParts("chair", FURNISHING_DEFAULT_SIZE.chair);
    expect(roles(parts).sort()).toEqual(["back", "leg", "leg", "leg", "leg", "seat"]);
    const seat = parts.find((p) => p.role === "seat")!;
    const legs = parts.filter((p) => p.role === "leg");
    expect(legs.every((l) => l.z + l.height <= seat.z + EPS)).toBe(true);
    expect(parts.find((p) => p.role === "back")!.z).toBeGreaterThanOrEqual(seat.z - EPS);
  });

  it("gives a table a top on four legs", () => {
    const parts = furnishingParts("table", FURNISHING_DEFAULT_SIZE.table);
    expect(roles(parts).sort()).toEqual(["leg", "leg", "leg", "leg", "top"]);
    const top = parts.find((p) => p.role === "top")!;
    expect(top.width).toBe(1500);
    expect(top.depth).toBe(800);
  });

  it("leaves a bath's recess unfilled, with a rim of four strips on its base", () => {
    const s = FURNISHING_DEFAULT_SIZE.bath;
    const parts = furnishingParts("bath", s);
    expect(roles(parts).sort()).toEqual(["base", "rim", "rim", "rim", "rim"]);
    const base = parts.find((p) => p.role === "base")!;
    const rims = parts.filter((p) => p.role === "rim");
    expect(base.width).toBe(s.width);
    expect(rims.every((r) => r.z >= base.z + base.height - EPS)).toBe(true);
    // The recess is the rim's inner rectangle: no part reaches into it above the base.
    const rim = rims[0]!.width; // the front strip runs the full width
    const t = rims[0]!.depth;
    const inner = { x: -s.width / 2 + t, y: -s.depth / 2 + t, width: s.width - 2 * t, depth: s.depth - 2 * t };
    expect(rim).toBe(s.width);
    for (const p of parts.filter((q) => q.role !== "base"))
      expect(overlap(p, { role: "recess", ...inner, z: base.height, height: s.height - base.height })).toBe(false);
  });

  it("builds every part from min(fixed, fraction) so a tiny size stays valid", () => {
    for (const kind of FURNISHING_KINDS) {
      const volume = furnishingParts(kind, tiny).reduce((sum, p) => sum + partVolume(p), 0);
      expect(volume, kind).toBeGreaterThan(0);
      expect(volume, kind).toBeLessThanOrEqual(10 * 10 * 10 + EPS);
    }
  });

  it("makes the file cabinet one body filling its size", () => {
    const parts = furnishingParts("file-cabinet", FURNISHING_DEFAULT_SIZE["file-cabinet"]);
    expect(parts).toHaveLength(1);
    expect(partVolume(parts[0]!)).toBe(450 * 600 * 1300);
  });
});

describe("what is seen from above", () => {
  const seen = (kind: FurnishingKind) => roles(visibleParts(furnishingParts(kind, FURNISHING_DEFAULT_SIZE[kind])));

  it("shows a table as its top, without its legs", () => {
    expect(seen("table")).toEqual(["top"]);
  });

  it("shows a chair as seat and back, without the legs beneath", () => {
    expect(seen("chair").sort()).toEqual(["back", "seat"]);
  });

  it("shows a bath as its base outline and rim strips", () => {
    expect(seen("bath").sort()).toEqual(["base", "rim", "rim", "rim", "rim"]);
  });

  it("hides a wash basin's pedestal under the bowl", () => {
    expect(seen("wash-basin")).not.toContain("pedestal");
    expect(seen("wash-basin")).toContain("bowl");
  });
});

describe("placement", () => {
  const table = furnishing("table-a", "table", pt(mm(3000), mm(2000)));
  const turned = (rotation: number) =>
    furnishing("table-a", "table", pt(mm(3000), mm(2000)), { rotation: deg(rotation) });
  const box = (f: ReturnType<typeof furnishing>) => bounds(furnishingFootprint(f));

  it("centres the footprint on at", () => {
    expect(box(table)).toEqual({ minX: 2250, maxX: 3750, minY: 1600, maxY: 2400 });
  });

  it("turns a quarter turn counter-clockwise about at", () => {
    const b = box(turned(90));
    expect(b.minX).toBeCloseTo(2600, 9);
    expect(b.maxX).toBeCloseTo(3400, 9);
    expect(b.minY).toBeCloseTo(1250, 9);
    expect(b.maxY).toBeCloseTo(2750, 9);
  });

  it("moves footprints but not volumes when rotated", () => {
    const flat = furnishingGeometry(table);
    const spun = furnishingGeometry(turned(37));
    expect(spun.volume).toBeCloseTo(flat.volume, 6);
    expect(spun.parts).toEqual(flat.parts);
    expect(spun.footprint[0]).not.toEqual(flat.footprint[0]);
  });

  it("turns the back from plan +y to plan -x at 90 degrees", () => {
    const bed = furnishing("bed-a", "bed", pt(mm(0), mm(0)), { rotation: deg(90) });
    const headboard = furnishingParts("bed", furnishingSize(bed)).find((p) => p.role === "headboard")!;
    const c = bounds(partFootprint(bed, headboard));
    expect(c.minX).toBeCloseTo(-1000, 9);
    expect(c.maxX).toBeCloseTo(-1000 + headboard.depth, 9);
  });

  it("lists footprint corners counter-clockwise", () => {
    const [a, b, , d] = partFootprint(table, { x: -750, y: -400, width: 1500, depth: 800 });
    expect(b!.x).toBeGreaterThan(a!.x);
    expect(d!.y).toBeGreaterThan(a!.y);
  });

  it("uses overridden sizes and the base elevation", () => {
    const bed = furnishing("bed-a", "bed", pt(mm(0), mm(0)), { width: mm(900), elevationOffset: mm(200) });
    const g = furnishingGeometry(bed);
    expect(g.size).toEqual({ width: 900, depth: 2000, height: 900 });
    expect(g.base).toBe(200);
    expect(bounds(g.footprint).maxX).toBe(450);
  });
});
