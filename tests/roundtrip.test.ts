import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import { area } from "../src/shared/geometry/polygon.js";
import { expectedVolumes } from "../src/backend/ifc/roundtrip.js";
import { BuildingModelSchema, type BuildingModel } from "../src/shared/schema/schema.js";

const parse = (source: unknown): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));

describe("expectedVolumes", () => {
  it("gives every slab its outline area times its thickness", () => {
    const model = parse(cottage);
    const byId = new Map(expectedVolumes(model).map((e) => [e.id, e]));
    for (const sl of model.storeys.flatMap((s) => s.slabs)) {
      expect(byId.get(sl.id)).toEqual({ id: sl.id, volume: area(sl.outline) * sl.thickness, what: "slab" });
    }
  });

  it("covers every wall, slab, door, window, stair segment and railing once, and skips doorways", () => {
    const model = parse(elmstead);
    const ids = expectedVolumes(model).map((e) => e.id);
    const wanted = model.storeys.flatMap((s) => [
      ...s.walls.map((w) => w.id),
      ...s.slabs.map((sl) => sl.id),
      ...s.openings.filter((o) => !(o.kind === "door" && o.doorway)).map((o) => o.id),
      ...(s.stairs ?? []).flatMap((st) => st.segments.map((seg) => seg.id)),
      ...(s.railings ?? []).map((r) => r.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...wanted].sort());
  });

  it("expects a positive volume for every element of both models", () => {
    for (const source of [cottage, elmstead]) {
      for (const e of expectedVolumes(parse(source))) expect(e.volume, e.id).toBeGreaterThan(0);
    }
  });
});
