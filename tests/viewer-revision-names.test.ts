import { describe, expect, it } from "vitest";
import { defaultName, groupModels, joinName, splitName, stepRevision } from "../viewer/revisions.js";

describe("viewer revision names", () => {
  it("splits and joins <model>@<revision>", () => {
    expect(splitName("elmstead@rear-extension")).toEqual({ model: "elmstead", revision: "rear-extension" });
    expect(splitName("elmstead")).toEqual({ model: "elmstead", revision: null });
    expect(joinName("elmstead", "rear-extension")).toBe("elmstead@rear-extension");
    expect(joinName("elmstead", null)).toBe("elmstead");
  });

  it("groups names by model, in name order, listing a model that only has revisions", () => {
    const groups = groupModels([
      "elmstead@rear-extension",
      "example-cottage",
      "elmstead",
      "elmstead@loft",
      "orphan@only",
    ]);
    expect([...groups]).toEqual([
      ["elmstead", { base: true, revisions: ["loft", "rear-extension"] }],
      ["example-cottage", { base: true, revisions: [] }],
      ["orphan", { base: false, revisions: ["only"] }],
    ]);
  });

  it("opens the base, or the first revision when the base is not built", () => {
    expect(defaultName("elmstead", { base: true, revisions: ["loft"] })).toBe("elmstead");
    expect(defaultName("orphan", { base: false, revisions: ["only", "other"] })).toBe("orphan@only");
  });

  it("steps through Existing and the revisions without wrapping, skipping an unbuilt base", () => {
    const g = { base: true, revisions: ["loft", "rear-extension"] };
    expect(stepRevision(g, null, 1)).toBe("loft");
    expect(stepRevision(g, "loft", -1)).toBeNull();
    expect(stepRevision(g, null, -1)).toBeUndefined();
    expect(stepRevision(g, "rear-extension", 1)).toBeUndefined();
    expect(stepRevision({ base: false, revisions: ["only"] }, "only", -1)).toBeUndefined();
  });
});
