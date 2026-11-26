import { describe, expect, it } from "vitest";
import { constraintsPath, entryPoint, modelName } from "../src/paths.js";

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

describe("constraintsPath", () => {
  it("finds constraints.ts in a folder model, given the folder or its index.ts", () => {
    expect(constraintsPath("models/elmstead")).toBe("models/elmstead/constraints.ts");
    expect(constraintsPath("models/elmstead/")).toBe("models/elmstead/constraints.ts");
    expect(constraintsPath("models/elmstead/index.ts")).toBe("models/elmstead/constraints.ts");
  });

  it("finds <name>.constraints.ts beside a single-file model", () => {
    expect(constraintsPath("tests/fixtures/broken-constraint.ts")).toBe("tests/fixtures/broken-constraint.constraints.ts");
  });
});
