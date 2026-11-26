import { describe, expect, it } from "vitest";
import { formatJson } from "../src/cli/json-format.js";
import { loadModel } from "../src/cli/load.js";

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
