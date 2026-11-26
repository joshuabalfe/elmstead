import { describe, expect, it } from "vitest";
import { formatJson } from "../src/cli/json-format.js";
import { loadModel, modelName, revisionOf } from "../src/cli/load.js";

describe("loadModel", () => {
  it("loads and validates the example cottage", async () => {
    const r = await loadModel("models/examples/example-cottage");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe("example-cottage");
  });

  it("loads a multi-file model from its folder or its index.ts, named after the folder", async () => {
    const byFolder = await loadModel("models/elmstead");
    const byIndex = await loadModel("models/elmstead/index.ts");
    expect(byFolder.ok && byFolder.value.name).toBe("elmstead");
    expect(byIndex.ok && byIndex.value.name).toBe("elmstead");
    expect(byFolder.ok && byIndex.ok && byFolder.value.model).toEqual(byIndex.ok && byIndex.value.model);
  });

  it("names outputs after the file, or the folder for index files", () => {
    expect(modelName("tests/fixtures/unconstrained.ts")).toBe("unconstrained");
    expect(modelName("models/elmstead")).toBe("elmstead");
    expect(modelName("models/elmstead/")).toBe("elmstead");
    expect(modelName("models/elmstead/index.ts")).toBe("elmstead");
  });

  it("names a revision <model>@<revision>, from its file, its folder or its index.ts", () => {
    expect(modelName("models/elmstead/revisions/rear-extension.ts")).toBe("elmstead@rear-extension");
    expect(modelName("models/examples/example-cottage/revisions/rear-extension.ts")).toBe("example-cottage@rear-extension");
    expect(modelName("tests/fixtures/revised/revisions/lean-to")).toBe("revised@lean-to");
    expect(modelName("tests/fixtures/revised/revisions/lean-to/")).toBe("revised@lean-to");
    expect(modelName("tests/fixtures/revised/revisions/lean-to/index.ts")).toBe("revised@lean-to");
    expect(revisionOf("tests/fixtures/revised/revisions/lean-to")).toEqual({ basePath: "tests/fixtures/revised", model: "revised", revision: "lean-to" });
  });

  it("does not take a model, a helper folder under revisions/ or a module inside a revision for a revision", () => {
    expect(revisionOf("models/elmstead")).toBeUndefined();
    expect(revisionOf("models/elmstead/index.ts")).toBeUndefined();
    expect(revisionOf("tests/fixtures/unconstrained.ts")).toBeUndefined();
    expect(revisionOf("tests/fixtures/revised/revisions/shared")).toBeUndefined();
    expect(revisionOf("tests/fixtures/revised/revisions/lean-to/openings.ts")).toBeUndefined();
    expect(modelName("tests/fixtures/revised/revisions/shared")).toBe("shared");
  });

  it("loads a folder revision that imports modules beneath it and beside it", async () => {
    const r = await loadModel("tests/fixtures/revised/revisions/lean-to");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("revised@lean-to");
      expect(r.value.model.storeys[0]!.walls.map((w) => w.id)).toContain("wall-lean-to-north");
    }
  });

  it("rejects a revision name that is not kebab-case", async () => {
    const r = await loadModel("tests/fixtures/revised/revisions/Lean_To.ts");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual([{ level: "ERROR", id: "tests/fixtures/revised/revisions/Lean_To.ts", message: expect.stringContaining("kebab-case") }]);
  });

  it("reports schema failures with the offending element id", async () => {
    const r = await loadModel("tests/fixtures/bad-thickness.ts");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]).toMatchObject({ level: "ERROR", id: "wall-hall-west" });
      expect(r.issues[0]!.message).toMatch(/storeys\.0\.walls\.4\.thickness/);
    }
  });
});

describe("formatJson", () => {
  it("is deterministic and puts points on one line", () => {
    const v = { a: [{ x: 1, y: 2 }], b: { c: "d" } };
    expect(formatJson(v)).toBe(formatJson(structuredClone(v)));
    expect(formatJson(v)).toContain('{ "x": 1, "y": 2 }');
    expect(JSON.parse(formatJson(v))).toEqual(v);
  });
});
