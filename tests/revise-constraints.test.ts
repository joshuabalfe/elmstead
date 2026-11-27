import { describe, expect, it } from "vitest";
import cottageConstraints from "../models/examples/example-cottage/constraints.js";
import { loadConstraints } from "../src/constraints/load.js";
import { CONSTRAINT_EDITS } from "../src/constraints/revise.js";
import {
  addGroups,
  inStorey,
  mm,
  removeConstraint,
  replaceConstraint,
  reviseConstraints,
  wallEnd,
  type Constraint,
  type ConstraintGroup,
} from "../src/constraints/index.js";
import { RevisionError } from "../src/schema/ids.js";

const base = (): ConstraintGroup[] => structuredClone(cottageConstraints);
const ids = (groups: ConstraintGroup[]) => groups.flatMap((g) => g.constraints.map((c) => c.id));
const find = (groups: ConstraintGroup[], id: string): Constraint =>
  groups.flatMap((g) => g.constraints).find((c) => c.id === id)!;
const wallLength = (id: string, distance: number): Constraint => ({
  id,
  from: wallEnd("wall-north", "start"),
  to: wallEnd("wall-north", "end"),
  measure: "straight",
  distance: mm(distance),
});

describe("reviseConstraints", () => {
  it("removes, replaces and adds, leaving the base alone and counting each", () => {
    const b = base();
    const before = JSON.stringify(b);
    const r = reviseConstraints(b, [
      removeConstraint("hall-width", "the hall is knocked through"),
      replaceConstraint({ ...find(b, "front-length"), distance: mm(9000) }),
      addGroups(inStorey("storey-ground", [wallLength("back-length", 8000)])),
    ]);
    expect(ids(r)).not.toContain("hall-width");
    expect(find(r, "front-length").distance).toBe(9000);
    expect(ids(r).at(-1)).toBe("back-length");
    expect(JSON.stringify(b)).toBe(before);
    expect((r as { [CONSTRAINT_EDITS]?: unknown })[CONSTRAINT_EDITS]).toEqual({ removed: 1, replaced: 1, added: 1 });
  });

  it("keeps a replaced constraint in its group and position", () => {
    const b = base();
    const r = reviseConstraints(b, [replaceConstraint({ ...find(b, "living-width"), distance: mm(3600) })]);
    expect(r.map((g) => ids([g]))).toEqual(b.map((g) => ids([g])));
  });

  it("drops a group left with no constraints, so its scope is not checked", () => {
    const b = base();
    const hall = b.find((g) => g.room === "room-hall")!;
    const r = reviseConstraints(
      b,
      hall.constraints.map((c) => removeConstraint(c.id, "the hall is knocked through")),
    );
    expect(r.some((g) => g.room === "room-hall")).toBe(false);
  });

  it("leaves the counts out of the JSON the loader validates", () => {
    expect(JSON.parse(JSON.stringify(reviseConstraints(base(), [])))).toEqual(JSON.parse(JSON.stringify(base())));
  });

  const error = (f: () => unknown): RevisionError => {
    try {
      f();
    } catch (e) {
      if (e instanceof RevisionError) return e;
      throw e;
    }
    throw new Error("expected a RevisionError");
  };

  it("names an unknown id on remove or replace", () => {
    expect(error(() => reviseConstraints(base(), [removeConstraint("kitchen-width", "gone")])).id).toBe(
      "kitchen-width",
    );
    expect(error(() => reviseConstraints(base(), [replaceConstraint(wallLength("kitchen-width", 1000))])).id).toBe(
      "kitchen-width",
    );
  });

  it("requires a note on a removal", () => {
    const e = error(() => reviseConstraints(base(), [removeConstraint("hall-width", "  ")]));
    expect(e.id).toBe("hall-width");
    expect(e.message).toContain("say why");
  });

  it("rejects an added id already in the constraints, or added twice", () => {
    expect(
      error(() => reviseConstraints(base(), [addGroups(inStorey("storey-ground", [wallLength("front-length", 8000)]))]))
        .id,
    ).toBe("front-length");
    expect(
      error(() =>
        reviseConstraints(base(), [
          addGroups(inStorey("storey-ground", [wallLength("back-length", 8000), wallLength("back-length", 8000)])),
        ]),
      ).id,
    ).toBe("back-length");
  });

  it("rejects a replacement that is not a valid constraint", () => {
    expect(
      error(() =>
        reviseConstraints(base(), [replaceConstraint({ ...find(base(), "hall-width"), distance: -1 as never })]),
      ).id,
    ).toBe("hall-width");
  });
});

describe("loading a revision's constraints", () => {
  it("inherits the base's constraints file when the revision has none", async () => {
    const r = await loadConstraints("tests/fixtures/revised/revisions/wide-window.ts");
    expect(r.ok && r.value).toMatchObject({
      path: "tests/fixtures/revised/constraints.ts",
      revision: { ownPath: "tests/fixtures/revised/revisions/wide-window.constraints.ts" },
    });
  });

  it("reads a folder revision's own constraints.ts, with its edits", async () => {
    const r = await loadConstraints("tests/fixtures/revised/revisions/wide-window-revised");
    expect(r.ok && r.value).toMatchObject({
      path: "tests/fixtures/revised/revisions/wide-window-revised/constraints.ts",
      revision: {
        ownPath: "tests/fixtures/revised/revisions/wide-window-revised/constraints.ts",
        edits: { removed: 1, replaced: 1, added: 1 },
      },
    });
  });

  it("never reads a revision's file for the base", async () => {
    const r = await loadConstraints("tests/fixtures/revised");
    expect(r.ok && r.value?.path).toBe("tests/fixtures/revised/constraints.ts");
    expect(r.ok && r.value?.revision).toBeUndefined();
  });
});
