import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import { loadModel } from "../src/backend/cli/load.js";
import { checkModel } from "../src/backend/checks/model.js";
import {
  addComponents,
  addTo,
  door,
  furnishing,
  mm,
  pt,
  railing,
  remove,
  replace,
  revise,
  RevisionError,
  wall,
  window,
  windowComponent,
} from "../src/backend/model/index.js";
import { BuildingModelSchema, type BuildingModel, type Wall, type Window } from "../src/shared/schema/schema.js";

const base = (): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
const ground = (m: BuildingModel) => m.storeys[0]!;
const wallOf = (m: BuildingModel, id: string) => ground(m).walls.find((w) => w.id === id);
const openingOf = (m: BuildingModel, id: string) => ground(m).openings.find((o) => o.id === id);
const longer = (w: Wall, by: number): Wall => ({ ...w, end: { x: mm(w.end.x - by), y: w.end.y } });

describe("revise", () => {
  it("removes elements and components by id or by element, leaving the base alone", () => {
    const b = base();
    const before = JSON.stringify(b);
    const r = revise(b, [remove("window-kitchen", wallOf(b, "wall-living-kitchen")!)]);
    expect(openingOf(r, "window-kitchen")).toBeUndefined();
    expect(wallOf(r, "wall-living-kitchen")).toBeUndefined();
    expect(JSON.stringify(b)).toBe(before);
  });

  it("replaces an element in its place, on its storey", () => {
    const b = base();
    const north = wallOf(b, "wall-north")!;
    const r = revise(b, [replace(longer(north, 500))]);
    expect(ground(r).walls.map((w) => w.id)).toEqual(ground(b).walls.map((w) => w.id));
    expect(wallOf(r, "wall-north")!.end.x).toBe(north.end.x - 500);
  });

  it("replaces a component", () => {
    const r = revise(base(), [replace(windowComponent("window-type-sash", "Casement window"))]);
    expect(r.components!.windows.find((c) => c.id === "window-type-sash")!.name).toBe("Casement window");
  });

  it("adds elements to a storey by collection, creating an optional collection", () => {
    const b = base();
    const lean = wall("wall-lean-to-east", pt(mm(5000), mm(6000)), pt(mm(5000), mm(8000)), {
      thickness: mm(100),
      height: mm(2400),
    });
    const r = revise(b, [
      addTo("storey-ground", {
        walls: [lean],
        openings: [door("doorway-lean-to", wallOf(b, "wall-north")!, mm(1000), { width: mm(900), height: mm(2100) })],
        railings: [{ id: "railing-lean-to", start: pt(mm(0), mm(7000)), end: pt(mm(1000), mm(7000)), height: mm(900) }],
      }),
    ]);
    expect(ground(r).walls.at(-1)).toEqual(lean);
    expect(openingOf(r, "doorway-lean-to")).toBeDefined();
    expect(ground(r).railings!.map((x) => x.id)).toEqual(["railing-lean-to"]);
    expect(ground(b).railings).toBeUndefined();
  });

  it("furnishes a storey, and replaces and removes a furnishing by id", () => {
    const b = base();
    const sofa = furnishing("sofa-living", "sofa", pt(mm(2000), mm(2000)));
    const table = furnishing("table-kitchen", "table", pt(mm(5000), mm(2000)));
    const furnished = revise(b, [addTo("storey-ground", { furnishings: [sofa, table] })]);
    expect(ground(furnished).furnishings!.map((f) => f.id)).toEqual(["sofa-living", "table-kitchen"]);
    expect(ground(b).furnishings).toBeUndefined();

    const moved = revise(furnished, [replace({ ...sofa, at: pt(mm(2500), mm(2000)) })]);
    expect(ground(moved).furnishings!.map((f) => f.id)).toEqual(["sofa-living", "table-kitchen"]);
    expect(ground(moved).furnishings![0]!.at.x).toBe(2500);

    const without = revise(furnished, [remove("table-kitchen")]);
    expect(ground(without).furnishings!.map((f) => f.id)).toEqual(["sofa-living"]);
    expect(ground(furnished).furnishings).toHaveLength(2);
  });

  it("adds components that new openings can use", () => {
    const b = base();
    const picture = windowComponent("window-type-picture", "Picture window");
    const r = revise(b, [
      addComponents({ windows: [picture] }),
      addTo("storey-ground", {
        openings: [
          window("window-picture", wallOf(b, "wall-west")!, mm(1000), picture, {
            width: mm(1500),
            height: mm(1200),
            sillHeight: mm(600),
          }),
        ],
      }),
    ]);
    expect((openingOf(r, "window-picture") as Window).componentId).toBe("window-type-picture");
    expect(checkModel(r).filter((i) => i.level === "ERROR")).toEqual([]);
  });

  it("applies edits in order", () => {
    const b = base();
    const north = wallOf(b, "wall-north")!;
    // A removal then an add of the same id works; the other way round the add finds the id taken.
    const r = revise(b, [remove("wall-north"), addTo("storey-ground", { walls: [longer(north, 500)] })]);
    expect(ground(r).walls.at(-1)!.id).toBe("wall-north");
    expect(() => revise(b, [addTo("storey-ground", { walls: [longer(north, 500)] }), remove("wall-north")])).toThrow(
      RevisionError,
    );
  });

  it("does not share added values with the revision file", () => {
    const lean = wall("wall-lean-to", pt(mm(0), mm(6000)), pt(mm(1000), mm(6000)), {
      thickness: mm(100),
      height: mm(2400),
    });
    const r = revise(base(), [addTo("storey-ground", { walls: [lean] })]);
    lean.thickness = mm(300);
    expect(wallOf(r, "wall-lean-to")!.thickness).toBe(100);
  });

  it("does not remove what depends on a removed element: the checks report it", () => {
    const r = revise(base(), [remove("wall-north")]);
    expect(checkModel(r)).toContainEqual(expect.objectContaining({ level: "ERROR", id: "door-back" }));
  });
});

describe("revise errors", () => {
  const error = (f: () => unknown): RevisionError => {
    try {
      f();
    } catch (e) {
      if (e instanceof RevisionError) return e;
      throw e;
    }
    throw new Error("expected a RevisionError");
  };

  it("names an unknown id", () => {
    expect(error(() => revise(base(), [remove("wall-rear-kitchen")])).id).toBe("wall-rear-kitchen");
    expect(error(() => revise(base(), [replace({ ...wallOf(base(), "wall-north")!, id: "wall-nope" })])).id).toBe(
      "wall-nope",
    );
  });

  it("rejects an id already in the model, including one added earlier in the same edit", () => {
    const w = wall("wall-lean-to", pt(mm(0), mm(6000)), pt(mm(1000), mm(6000)), {
      thickness: mm(100),
      height: mm(2400),
    });
    expect(error(() => revise(base(), [addTo("storey-ground", { walls: [{ ...w, id: "wall-north" }] })])).id).toBe(
      "wall-north",
    );
    expect(error(() => revise(base(), [addTo("storey-ground", { walls: [w, w] })])).id).toBe("wall-lean-to");
    expect(
      error(() => revise(base(), [addComponents({ doors: [{ id: "door-type-external", name: "Again" }] })])).id,
    ).toBe("door-type-external");
  });

  it("rejects replacing a furnishing with a railing of the same id", () => {
    const furnished = revise(base(), [
      addTo("storey-ground", { furnishings: [furnishing("sofa-living", "sofa", pt(mm(2000), mm(2000)))] }),
    ]);
    const e = error(() =>
      revise(furnished, [replace(railing("sofa-living", pt(mm(0), mm(0)), pt(mm(1000), mm(0)), { height: mm(900) }))]),
    );
    expect(e.id).toBe("sofa-living");
    expect(e.message).toContain("not a valid furnishings entry");
  });

  it("rejects an unknown storey and any storey edit", () => {
    expect(error(() => revise(base(), [addTo("storey-attic", {})])).message).toContain("not a storey");
    expect(error(() => revise(base(), [remove("storey-ground")])).message).toContain("revisions cannot change storeys");
  });

  it("rejects a replacement its collection does not accept", () => {
    const e = error(() =>
      revise(base(), [replace({ id: "wall-north", start: pt(mm(0), mm(0)), end: pt(mm(1), mm(0)), height: mm(900) })]),
    );
    expect(e.id).toBe("wall-north");
    expect(e.message).toContain("not a valid walls entry");
  });

  it("rejects editing the project, site or building", () => {
    expect(error(() => revise(base(), [remove("site-default")])).message).toContain("not edited on its own");
  });
});

describe("loading a revision that cannot be applied", () => {
  for (const [fixture, id] of [
    ["unknown-id", "wall-rear-kitchen"],
    ["duplicate-id", "wall-north"],
    ["unknown-storey", "storey-attic"],
    ["storey-edit", "storey-ground"],
    ["wrong-collection", "wall-north"],
  ] as const) {
    it(`reports one ERROR against the id: ${fixture}`, async () => {
      const r = await loadModel(`tests/fixtures/revise-errors/${fixture}.ts`);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.issues).toHaveLength(1);
        expect(r.issues[0]).toMatchObject({ level: "ERROR", id });
        expect(r.issues[0]!.message).toMatch(/^revision: /);
      }
    });
  }
});
