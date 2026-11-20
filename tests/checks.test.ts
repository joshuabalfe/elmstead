import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage.js";
import { checkComponents } from "../src/checks/components.js";
import { BuildingModelSchema, type BuildingModel } from "../src/schema/schema.js";

const model = (): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
const opening = (m: BuildingModel, id: string) => m.storeys[0]!.openings.find((o) => o.id === id)!;

describe("checkComponents", () => {
  it("accepts the cottage, whose openings all name a component of their size", () => {
    expect(checkComponents(model())).toEqual([]);
  });

  it("reports a componentId that is not in components, against the opening", () => {
    const m = model();
    opening(m, "door-living").componentId = "door-type-missing";
    expect(checkComponents(m)).toEqual([{ level: "ERROR", id: "door-living", message: "componentId door-type-missing is not in components" }]);
  });

  it("reports a door that names a window component", () => {
    const m = model();
    opening(m, "door-living").componentId = "window-type-sash";
    expect(checkComponents(m)).toEqual([{ level: "ERROR", id: "door-living", message: "componentId window-type-sash is a window component" }]);
  });

  it("reports an opening that is not its component's size", () => {
    const m = model();
    opening(m, "window-kitchen").width = 1000 as never;
    expect(checkComponents(m)).toEqual([{ level: "ERROR", id: "window-kitchen", message: "1000 × 1200 mm, but its component window-type-sash is 1200 × 1200 mm" }]);
  });

  it("reports a component id used twice", () => {
    const m = model();
    m.components!.windows.push({ ...m.components!.doors[0]! });
    expect(checkComponents(m)).toEqual([{ level: "ERROR", id: "door-type-external", message: "component id is used twice" }]);
  });

  it("accepts openings without a component, and models without components", () => {
    const m = model();
    delete m.components;
    for (const o of m.storeys[0]!.openings) delete o.componentId;
    expect(checkComponents(m)).toEqual([]);
  });
});
