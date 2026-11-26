import { describe, expect, it } from "vitest";
import { z } from "zod";
import cottage from "../models/examples/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import { COMPONENT_COLLECTIONS, idEntries, indexIds, STOREY_COLLECTIONS } from "../src/schema/ids.js";
import { BuildingModelSchema, ComponentsSchema, StoreySchema, type BuildingModel } from "../src/schema/schema.js";

const model = (source: unknown): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));

/** The keys of a zod object whose values are arrays, optional or not. */
const arrayKeys = (shape: Record<string, z.ZodType>): string[] =>
  Object.entries(shape)
    .filter(([, t]) => (t instanceof z.ZodOptional ? t.unwrap() : t) instanceof z.ZodArray)
    .map(([k]) => k)
    .sort();

describe("idEntries", () => {
  it("names every collection of id-bearing elements the schema has", () => {
    // A new array on a storey or in components must be indexed, or revise and the checks miss it.
    expect([...STOREY_COLLECTIONS].sort()).toEqual(arrayKeys(StoreySchema.shape));
    expect([...COMPONENT_COLLECTIONS].sort()).toEqual(arrayKeys(ComponentsSchema.shape));
  });

  it("lists every id once, in model order, with its kind, storey and place", () => {
    const m = model(cottage);
    const entries = idEntries(m);
    expect(entries.slice(0, 4).map((e) => [e.id, e.kind])).toEqual([
      [m.project.id, "project"],
      [m.site.id, "site"],
      [m.building.id, "building"],
      ["storey-ground", "storey"],
    ]);
    const door = entries.find((e) => e.id === "door-living")!;
    expect(door).toMatchObject({ kind: "door", storey: "storey-ground", place: { storey: "storey-ground", collection: "openings" } });
    expect(m.storeys[0]!.openings[(door.place as { index: number }).index]!.id).toBe("door-living");
    const component = entries.find((e) => e.kind === "window component")!;
    expect(component.storey).toBeUndefined();
    expect(component.place).toMatchObject({ collection: "windows" });
  });

  it("covers stairs, their segments and railings", () => {
    const kinds = new Set([...idEntries(model(twoStorey)), ...idEntries(model(elmstead))].map((e) => e.kind));
    for (const kind of ["wall", "door", "window", "slab", "room", "stair", "stair flight", "stair landing", "railing", "door component", "window component"]) {
      expect(kinds, kind).toContain(kind);
    }
  });

  it("gives stair segments no place of their own", () => {
    const segment = idEntries(model(twoStorey)).find((e) => e.kind === "stair flight")!;
    expect(segment.storey).toBeDefined();
    expect(segment.place).toBeUndefined();
  });

  it("keeps duplicates, for checkIds to report", () => {
    const m = model(cottage);
    m.storeys[0]!.walls[1]!.id = m.storeys[0]!.walls[0]!.id;
    expect(idEntries(m).filter((e) => e.id === m.storeys[0]!.walls[0]!.id)).toHaveLength(2);
  });
});

describe("indexIds", () => {
  it("indexes every id, keeping the first of a duplicate", () => {
    const m = model(cottage);
    const first = m.storeys[0]!.walls[0]!;
    m.storeys[0]!.walls[1]!.id = first.id;
    const ix = indexIds(m);
    expect(ix.get(first.id)!.element).toBe(first);
    expect(ix.size).toBe(new Set(idEntries(m).map((e) => e.id)).size);
  });
});
