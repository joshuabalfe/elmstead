/** The furnished example revision: a revision that furnishes the cottage and touches nothing else. */
import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import furnished from "../models/examples/example-cottage/revisions/furnished.js";
import { checkModel } from "../src/backend/checks/model.js";
import { loadModel } from "../src/backend/cli/load.js";
import { roundTripChecks } from "../src/backend/ifc/roundtrip.js";
import { writeIfc } from "../src/backend/ifc/writer.js";
import { diffModels } from "../src/shared/diff/index.js";
import { FURNISHING_KINDS } from "../src/shared/schema/schema.js";
import { renderPlan } from "../src/shared/render/plan.js";
import { BuildingModelSchema } from "../src/shared/schema/schema.js";

const parse = (source: unknown) => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));
const base = parse(cottage);
const model = parse(furnished);
const items = model.storeys[0]!.furnishings!;

describe("the furnished cottage", () => {
  it("furnishes the ground storey with one of every kind and a turned item", () => {
    expect(items.map((f) => f.kind).sort()).toEqual([...FURNISHING_KINDS].sort());
    expect(items.some((f) => f.rotation)).toBe(true);
    expect(items.some((f) => f.elevationOffset)).toBe(true);
  });

  it("loads as the example-cottage revision named furnished, with no check ERRORs", async () => {
    const r = await loadModel("models/examples/example-cottage/revisions/furnished");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.model.storeys[0]!.furnishings).toHaveLength(12);
    expect(checkModel(model).filter((i) => i.level === "ERROR")).toEqual([]);
  });

  it("changes nothing but the furnishings of the base cottage", () => {
    const bare = structuredClone(model);
    delete bare.storeys[0]!.furnishings;
    expect(bare).toEqual(base);
    const d = diffModels(base, model);
    expect(d.added.map((e) => e.kind)).toEqual(Array(12).fill("furnishing"));
    expect([d.removed, d.changed]).toEqual([[], []]);
  });

  it("draws a furnishing group for every item", () => {
    const plan = renderPlan(model, model.storeys[0]!, { ids: false });
    for (const f of items) expect(plan, f.id).toContain(`class="furnishing" data-id="${f.id}"`);
    expect(plan.match(/class="furnishing"/g)).toHaveLength(12);
  });

  it("matches the committed reference drawing (update with: npx vitest run -u)", async () => {
    await expect(renderPlan(model, model.storeys[0]!, { ids: false })).toMatchFileSnapshot(
      "__snapshots__/example-cottage-furnished.storey-ground.plan.svg",
    );
  });

  it("round-trips through IFC with every furnishing's volume", async () => {
    expect(await roundTripChecks(model, await writeIfc(model, { fileName: "furnished.ifc" }))).toEqual([]);
  });

  it("leaves the base cottage's plan as it was", () => {
    const plan = renderPlan(base, base.storeys[0]!, { ids: false });
    expect(plan).not.toContain("furnishing");
  });
});
