import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import rearExtension from "../models/examples/example-cottage/revisions/rear-extension.js";
import elmstead from "../models/elmstead/index.js";
import twoStorey from "./fixtures/two-storey/index.js";
import { diffModels, type ModelDiff } from "../src/diff/index.js";
import { addComponents, addTo, door, mm, pt, remove, replace, revise, wall, windowComponent } from "../src/model/index.js";
import { idNodes } from "../src/schema/ids.js";
import { BuildingModelSchema, type BuildingModel, type Door, type Wall, type Window } from "../src/schema/schema.js";

const model = (source: unknown): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));
const base = () => model(cottage);
const ground = (m: BuildingModel) => m.storeys[0]!;
const wallOf = (m: BuildingModel, id: string) => ground(m).walls.find((w) => w.id === id)!;
const openingOf = (m: BuildingModel, id: string) => ground(m).openings.find((o) => o.id === id)!;
const ids = (d: ModelDiff) => ({ added: d.added.map((e) => e.id), removed: d.removed.map((e) => e.id), changed: d.changed.map((e) => e.id) });

describe("diffModels", () => {
  it("lists nothing for a revision with no edits", () => {
    expect(diffModels(base(), model(revise(base(), [])))).toEqual({ added: [], removed: [], changed: [] });
  });

  it("finds the example rear extension's changes, each in its model's order", () => {
    expect(ids(diffModels(base(), model(rearExtension)))).toEqual({
      added: ["wall-lean-to-east", "wall-lean-to-north", "wall-lean-to-west", "doorway-lean-to", "slab-lean-to", "room-lean-to"],
      removed: ["wall-living-kitchen", "window-kitchen", "room-kitchen"],
      changed: ["window-living", "room-living"],
    });
  });

  it("gives each entry its kind and storey, a removed one the base storey it was on", () => {
    const d = diffModels(base(), model(rearExtension));
    expect(d.added[0]).toEqual({ id: "wall-lean-to-east", kind: "wall", storey: "storey-ground" });
    expect(d.removed.find((e) => e.id === "window-kitchen")).toEqual({ id: "window-kitchen", kind: "window", storey: "storey-ground" });
    expect(d.changed.find((e) => e.id === "room-living")).toEqual({ id: "room-living", kind: "room", storey: "storey-ground" });
  });

  it("reports a renamed element as removed and added", () => {
    const b = base();
    const kitchen = openingOf(b, "window-kitchen") as Window;
    const d = diffModels(b, model(revise(b, [remove("window-kitchen"), addTo("storey-ground", { openings: [{ ...kitchen, id: "window-kitchen-new" }] })])));
    expect(ids(d)).toEqual({ added: ["window-kitchen-new"], removed: ["window-kitchen"], changed: [] });
  });

  it("counts an element moved to another storey as changed", () => {
    const b = model(twoStorey);
    const slab = b.storeys[1]!.slabs[0]!;
    const r = model(b);
    r.storeys[1]!.slabs.splice(0, 1);
    r.storeys[0]!.slabs.push(slab);
    expect(diffModels(b, r).changed).toEqual([{ id: slab.id, kind: "slab", storey: b.storeys[0]!.id }]);
  });

  it("compares a storey by its own fields only", () => {
    const b = base();
    const extra = wall("wall-extra", pt(mm(0), mm(7000)), pt(mm(1000), mm(7000)), { thickness: mm(100), height: mm(2400) });
    const withWall = diffModels(b, model(revise(b, [addTo("storey-ground", { walls: [extra] })])));
    expect(ids(withWall)).toEqual({ added: ["wall-extra"], removed: [], changed: [] });
    const raised = model(b);
    raised.storeys[0]!.elevation = mm(100);
    expect(diffModels(b, raised).changed).toEqual([{ id: "storey-ground", kind: "storey", storey: "storey-ground" }]);
  });

  it("compares a stair as a whole, its segments included", () => {
    const b = model(twoStorey);
    const r = model(b);
    const st = r.storeys[0]!.stairs![0]!;
    const flight = st.segments.find((s) => s.kind === "flight")!;
    if (flight.kind === "flight") flight.risers += 1;
    const d = diffModels(b, r);
    expect(d.changed.map((e) => e.id)).toEqual([st.id]);
    expect(d.changed[0]!.kind).toBe("stair");
  });
});

describe("diffModels: openings follow their wall and component", () => {
  it("counts an opening whose component is replaced as changed, with the component", () => {
    const b = base();
    const d = diffModels(b, model(revise(b, [replace(windowComponent("window-type-sash", "Casement window"))])));
    expect(d.changed.map((e) => e.id)).toEqual(["window-living", "window-bedroom", "window-kitchen", "window-bathroom", "window-type-sash"]);
    expect(d.changed.at(-1)!.kind).toBe("window component");
  });

  it("counts an opening whose component is newly added as changed", () => {
    const b = base();
    const picture = windowComponent("window-type-picture", "Picture window");
    const living = openingOf(b, "window-living") as Window;
    const d = diffModels(b, model(revise(b, [addComponents({ windows: [picture] }), replace({ ...living, componentId: picture.id })])));
    expect(ids(d)).toEqual({ added: ["window-type-picture"], removed: [], changed: ["window-living"] });
  });

  it("counts the openings in a wall whose start moved as changed, though their own JSON is the same", () => {
    const b = base();
    const north = wallOf(b, "wall-north") as Wall;
    const d = diffModels(b, model(revise(b, [replace({ ...north, start: { x: mm(north.start.x + 500), y: north.start.y } })])));
    expect(ids(d).changed).toEqual(["wall-north", "door-back", "window-kitchen"]);
  });

  it("counts a door re-hosted on a new wall as changed, the old wall removed and the new one added", () => {
    const b = base();
    const old = wallOf(b, "wall-north");
    const back = openingOf(b, "door-back") as Door;
    const d = diffModels(b, model(revise(b, [remove("window-kitchen", "door-back", "wall-north"), addTo("storey-ground", { walls: [{ ...old, id: "wall-north-new" }], openings: [door(back.id, { ...old, id: "wall-north-new" }, back.offsetAlongWall, { width: back.width, height: back.height })] })])));
    expect(ids(d)).toEqual({ added: ["wall-north-new"], removed: ["wall-north", "window-kitchen"], changed: ["door-back"] });
  });
});

describe("diffModels coverage", () => {
  it("reports a change to every kind of element idNodes walks", () => {
    // Elmstead has every kind. A kind idNodes gains later fails here until the diff compares it.
    const NOT_COMPARED = ["project", "site", "building", "stair flight", "stair landing"];
    const b = model(elmstead);
    const kinds = [...new Set(idNodes(b).map((n) => n.kind))].filter((k) => !NOT_COMPARED.includes(k));
    expect(kinds.sort()).toEqual(["door", "door component", "railing", "room", "slab", "stair", "storey", "wall", "window", "window component"]);
    for (const kind of kinds) {
      const r = model(b);
      const node = idNodes(r).find((n) => n.kind === kind)!;
      (node.element as { name?: string }).name = "changed by the coverage test";
      expect(diffModels(b, r).changed.map((e) => e.id), kind).toContain(node.element.id);
    }
  });
});
