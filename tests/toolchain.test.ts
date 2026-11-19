import { spawnSync } from "node:child_process";
import * as WebIFC from "web-ifc";
import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("web-ifc initialises in Node and writes an IFC4 model", async () => {
    const api = new WebIFC.IfcAPI();
    await api.Init();
    const id = api.CreateModel({ schema: WebIFC.Schemas.IFC4 });
    const text = new TextDecoder().decode(api.SaveModel(id));
    api.CloseModel(id);
    expect(text).toContain("FILE_SCHEMA(('IFC4'))");
  });

  it("uv can run the IfcOpenShell validator script", () => {
    const r = spawnSync("uv", ["run", "--quiet", "validator/validate.py", "--version"], { encoding: "utf8" });
    expect(r.error, "uv not found: brew install uv").toBeUndefined();
    expect(r.stdout).toContain("ifcopenshell 0.9.0.post1");
  }, 120_000);
});
