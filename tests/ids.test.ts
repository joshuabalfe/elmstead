import { describe, expect, it } from "vitest";
import { z } from "zod";
import cottage from "../models/examples/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import { COMPONENT_COLLECTIONS, idNodes, STOREY_COLLECTIONS } from "../src/schema/ids.js";
import { BuildingModelSchema, ComponentsSchema, StoreySchema, type BuildingModel } from "../src/schema/schema.js";

const model = (source: unknown): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));

/** The keys of a zod object whose values are arrays, optional or not. */
const arrayKeys = (shape: Record<string, z.ZodType>): string[] =>
  Object.entries(shape)
    .filter(([, t]) => (t instanceof z.ZodOptional ? t.unwrap() : t) instanceof z.ZodArray)
    .map(([k]) => k)
    .sort();

describe("idNodes places", () => {
  it("names every collection of id-bearing elements the schema has", () => {
    // A new array on a storey or in components must be walked, or revise and the checks miss it.
    expect([...STOREY_COLLECTIONS].sort()).toEqual(arrayKeys(StoreySchema.shape));
    expect([...COMPONENT_COLLECTIONS].sort()).toEqual(arrayKeys(ComponentsSchema.shape));
  });

  it("gives each element and component the place it can be edited at", () => {
    const m = model(cottage);
    const door = idNodes(m).find((n) => n.element.id === "door-living")!;
    expect(door).toMatchObject({
      kind: "door",
      storey: "storey-ground",
      place: { storey: "storey-ground", collection: "openings" },
    });
    if (!("place" in door) || !("storey" in door.place)) throw new Error("door has no storey place");
    expect(m.storeys[0]!.openings[door.place.index]!.id).toBe("door-living");
    const component = idNodes(m).find((n) => n.kind === "window component")!;
    expect(component).toMatchObject({ place: { collection: "windows" } });
  });

  it("gives every editable kind a place, and storeys, stair segments and the project none", () => {
    const nodes = [...idNodes(model(twoStorey)), ...idNodes(model(elmstead)), ...idNodes(model(cottage))];
    const placed = new Set(nodes.filter((n) => "place" in n).map((n) => n.kind));
    const unplaced = new Set(nodes.filter((n) => !("place" in n)).map((n) => n.kind));
    expect([...placed].sort()).toEqual([
      "door",
      "door component",
      "railing",
      "room",
      "slab",
      "stair",
      "wall",
      "window",
      "window component",
    ]);
    expect([...unplaced].sort()).toEqual(["building", "project", "site", "stair flight", "stair landing", "storey"]);
  });
});
