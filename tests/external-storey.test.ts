import { describe, expect, it } from "vitest";
import external from "../models/example-external-storey/index.js";
import { checkModel } from "../src/checks/model.js";
import { renderFloor, renderPlan } from "../src/render/plan.js";
import { C } from "../src/render/style.js";
import { BuildingModelSchema } from "../src/schema/schema.js";

const model = BuildingModelSchema.parse(JSON.parse(JSON.stringify(external)));
const street = model.storeys.find((s) => s.id === "storey-street")!;
const ground = model.storeys.find((s) => s.id === "storey-ground")!;

describe("external storey example", () => {
  it("validates and passes the model checks", () => {
    expect(checkModel(model)).toEqual([]);
  });

  it("renders the external ground and the front steps on the street plan", () => {
    const plan = renderPlan(model, street, { ids: false });
    expect(plan).toContain(`fill="${C.ground}"`);
    expect(plan).toContain('class="stair-flight" data-id="stair-flight-front"');
  });

  it("fills the street floor overlay with the ground colour only", () => {
    expect(renderFloor(street).svg).toContain(`fill="${C.ground}"`);
    expect(renderFloor(ground).svg).not.toContain(`fill="${C.ground}"`);
  });
});