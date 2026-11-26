import { describe, expect, it } from "vitest";
import { constraintsPath, entryPoint, modelName, revisionOf } from "../src/paths.js";

describe("entryPoint", () => {
  it("is index.ts inside a folder model", () => {
    expect(entryPoint("models/elmstead")).toBe("models/elmstead/index.ts");
  });

  it("passes a file path through unchanged, whether or not it exists", () => {
    expect(entryPoint("models/elmstead/index.ts")).toBe("models/elmstead/index.ts");
    expect(entryPoint("tests/fixtures/unconstrained.ts")).toBe("tests/fixtures/unconstrained.ts");
    expect(entryPoint("models/no-such-model")).toBe("models/no-such-model");
  });
});

describe("modelName", () => {
  it("names outputs after the file, or the folder for index files", () => {
    expect(modelName("tests/fixtures/unconstrained.ts")).toBe("unconstrained");
    expect(modelName("models/elmstead")).toBe("elmstead");
    expect(modelName("models/elmstead/")).toBe("elmstead");
    expect(modelName("models/elmstead/index.ts")).toBe("elmstead");
  });

  it("strips any TypeScript or JavaScript module extension", () => {
    expect(modelName("x/cottage.mts")).toBe("cottage");
    expect(modelName("x/cottage.cjs")).toBe("cottage");
  });
});

describe("revisions", () => {
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
});

describe("constraintsPath", () => {
  it("finds constraints.ts in a folder model, given the folder or its index.ts", () => {
    expect(constraintsPath("models/elmstead")).toBe("models/elmstead/constraints.ts");
    expect(constraintsPath("models/elmstead/")).toBe("models/elmstead/constraints.ts");
    expect(constraintsPath("models/elmstead/index.ts")).toBe("models/elmstead/constraints.ts");
  });

  it("finds a revision's own constraints file, beside a file revision or inside a folder one", () => {
    expect(constraintsPath("models/elmstead/revisions/rear-extension.ts")).toBe("models/elmstead/revisions/rear-extension.constraints.ts");
    expect(constraintsPath("tests/fixtures/revised/revisions/lean-to")).toBe("tests/fixtures/revised/revisions/lean-to/constraints.ts");
  });

  it("finds <name>.constraints.ts beside a single-file model", () => {
    expect(constraintsPath("tests/fixtures/broken-constraint.ts")).toBe("tests/fixtures/broken-constraint.constraints.ts");
  });
});
