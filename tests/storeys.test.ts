import { describe, expect, it } from "vitest";
import { isStoreyPrefix, storeysLowestFirst, storeyTop } from "../src/frontend/lib/storeys.js";
import { mm, pt, wall } from "../src/backend/model/index.js";
import type { Storey } from "../src/shared/schema/schema.js";

describe("storeysLowestFirst", () => {
  it("orders by elevation without mutating the model's order", () => {
    const storeys = [
      { id: "first", elevation: 3000 },
      { id: "ground", elevation: 0 },
      { id: "attic", elevation: 6000 },
    ];
    const model = { storeys };
    expect(storeysLowestFirst(model).map((s) => s.id)).toEqual(["ground", "first", "attic"]);
    expect(model.storeys.map((s) => s.id)).toEqual(["first", "ground", "attic"]);
  });
});

describe("isStoreyPrefix", () => {
  const ordered = [{ id: "ground" }, { id: "first" }, { id: "attic" }];

  it("accepts every storey up to one floor", () => {
    expect(isStoreyPrefix(["ground"], ordered)).toBe(true);
    expect(isStoreyPrefix(["ground", "first"], ordered)).toBe(true);
    expect(isStoreyPrefix(["ground", "first", "attic"], ordered)).toBe(true);
  });

  it("is false for a gap", () => {
    expect(isStoreyPrefix(["ground", "attic"], ordered)).toBe(false);
    expect(isStoreyPrefix(["first"], ordered)).toBe(false);
  });

  it("ignores the order of the ids", () => {
    expect(isStoreyPrefix(["first", "ground"], ordered)).toBe(true);
  });
});

describe("storeyTop", () => {
  const storey = (over: Partial<Storey>): Storey =>
    ({ elevation: 0, walls: [], openings: [], slabs: [], ...over }) as Storey;

  it("is the tallest wall top above the elevation", () => {
    const s = storey({
      walls: [wall("w", pt(mm(0), mm(0)), pt(mm(1000), mm(0)), { thickness: mm(200), height: mm(2400) })],
    });
    expect(storeyTop(s, new Map())).toBe(2.4);
  });

  it("is topped by openings, slabs, railings and the storey a stair climbs to", () => {
    const above = storey({ elevation: mm(3000) });
    const byId = new Map([["first", above]]);
    expect(storeyTop(storey({ openings: [{ sillHeight: 900, height: 1200 } as never] }), byId)).toBe(2.1);
    expect(storeyTop(storey({ slabs: [{ elevationOffset: 2500 } as never] }), byId)).toBe(2.5);
    expect(storeyTop(storey({ railings: [{ height: 1000, startBase: 200 } as never] }), byId)).toBe(1.2);
    expect(storeyTop(storey({ stairs: [{ toStoreyId: "first" } as never] }), byId)).toBe(3);
  });

  it("takes the maximum across every kind and the elevation", () => {
    const above = storey({ elevation: mm(4000) });
    const byId = new Map([["attic", above]]);
    const s = storey({
      elevation: mm(1000),
      walls: [wall("w", pt(mm(0), mm(0)), pt(mm(1000), mm(0)), { thickness: mm(200), height: mm(2400) })],
      openings: [{ sillHeight: 900, height: 1200 } as never],
      slabs: [{ elevationOffset: 2500 } as never],
      stairs: [{ toStoreyId: "attic" } as never],
    });
    expect(storeyTop(s, byId)).toBe(4);
  });
});
