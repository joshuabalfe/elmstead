import { describe, expect, it } from "vitest";
import { z } from "zod";
import cottage from "../models/examples/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import winderStair from "./fixtures/winder-stair/index.js";
import {
  COMPONENT_COLLECTIONS,
  COMPONENT_KINDS,
  idNodes,
  STOREY_COLLECTIONS,
  STOREY_KINDS,
  type IdPlace,
} from "../src/shared/schema/ids.js";
import {
  BuildingModelSchema,
  ComponentsSchema,
  StoreySchema,
  type BuildingModel,
} from "../src/shared/schema/schema.js";

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
    const nodes = [
      ...idNodes(model(twoStorey)),
      ...idNodes(model(winderStair)),
      ...idNodes(model(elmstead)),
      ...idNodes(model(cottage)),
    ];
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
    expect([...unplaced].sort()).toEqual([
      "building",
      "project",
      "site",
      "stair flight",
      "stair landing",
      "stair winder",
      "storey",
    ]);
  });
});

describe("element-kind table", () => {
  it("covers every storey and component array in the schema", () => {
    // The `satisfies` in kinds.ts catches this at typecheck; this is its runtime mirror.
    expect(Object.keys(STOREY_KINDS).sort()).toEqual(arrayKeys(StoreySchema.shape));
    expect(Object.keys(COMPONENT_KINDS).sort()).toEqual(arrayKeys(ComponentsSchema.shape));
    expect([...STOREY_COLLECTIONS]).toEqual(Object.keys(STOREY_KINDS));
    expect([...COMPONENT_COLLECTIONS]).toEqual(Object.keys(COMPONENT_KINDS));
  });

  it("walks the two-storey fixture in model order", () => {
    const place = (p: IdPlace): string =>
      "storey" in p ? `${p.collection}[${p.index}]@${p.storey}` : `${p.collection}[${p.index}]`;
    const walked = idNodes(model(twoStorey)).map((n) =>
      [n.kind, n.element.id, "storey" in n ? n.storey : "-", "place" in n ? place(n.place) : "-"].join(" | "),
    );
    expect(walked).toEqual([
      "project | project-example-two-storey | - | -",
      "site | site-example | - | -",
      "building | building-example | - | -",
      "storey | storey-ground | storey-ground | -",
      "wall | wall-south | storey-ground | walls[0]@storey-ground",
      "wall | wall-east | storey-ground | walls[1]@storey-ground",
      "wall | wall-north | storey-ground | walls[2]@storey-ground",
      "wall | wall-west | storey-ground | walls[3]@storey-ground",
      "slab | slab-ground | storey-ground | slabs[0]@storey-ground",
      "room | room-hall | storey-ground | rooms[0]@storey-ground",
      "stair | stair-main | storey-ground | stairs[0]@storey-ground",
      "stair flight | stair-flight-lower | storey-ground | -",
      "stair landing | stair-landing-half | storey-ground | -",
      "stair flight | stair-flight-upper | storey-ground | -",
      "storey | storey-first | storey-first | -",
      "wall | wall-first-south | storey-first | walls[0]@storey-first",
      "wall | wall-first-east | storey-first | walls[1]@storey-first",
      "wall | wall-first-north | storey-first | walls[2]@storey-first",
      "wall | wall-first-west | storey-first | walls[3]@storey-first",
      "slab | slab-first | storey-first | slabs[0]@storey-first",
      "room | room-first | storey-first | rooms[0]@storey-first",
    ]);
  });
});
