import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { confinedPath } from "../viewer/serve.js";
import { parseView } from "../viewer/view.js";

const dir = "/tmp/elmstead-out";

describe("confinedPath", () => {
  it("serves a file inside the directory", () => {
    expect(confinedPath(dir, "cottage.ifc")).toBe(resolve(dir, "cottage.ifc"));
    expect(confinedPath(dir, "nested/cottage.ifc")).toBe(resolve(dir, "nested/cottage.ifc"));
  });

  it("rejects traversal, sibling prefixes and absolute paths", () => {
    expect(confinedPath(dir, "../out-x/secret.ifc")).toBeUndefined();
    expect(confinedPath(dir, "%2e%2e/out-x/secret.ifc")).toBeUndefined();
    expect(confinedPath(dir, "/etc/passwd")).toBeUndefined();
  });

  it("rejects malformed percent-encoding without throwing", () => {
    expect(confinedPath(dir, "%E0%A4%A")).toBeUndefined();
  });
});

describe("parseView", () => {
  it("accepts the five camera views and falls back to top", () => {
    for (const view of ["sw", "se", "ne", "nw", "top"] as const) expect(parseView(view)).toBe(view);
    expect(parseView("sideways")).toBe("top");
    expect(parseView(null)).toBe("top");
  });
});