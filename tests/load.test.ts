import { describe, expect, it } from "vitest";
import { formatJson } from "../src/cli/json-format.js";
import { loadModel, modelName } from "../src/cli/load.js";

describe("loadModel", () => {
  it("loads and validates the example cottage", async () => {
    const r = await loadModel("models/example-cottage");
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
