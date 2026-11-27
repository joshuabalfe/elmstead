import { describe, expect, it } from "vitest";
import { isStoreyPrefix, storeysLowestFirst } from "../src/frontend/lib/storeys.js";

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
