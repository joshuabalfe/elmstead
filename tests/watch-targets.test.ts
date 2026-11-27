import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scopeFor, targetFor } from "../scripts/watch-targets.js";

let root: string;
const at = (...parts: string[]) => join(root, ...parts);

function file(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "export default {};\n");
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "elmstead-watch-targets-"));
  file(at("elmstead", "index.ts"));
  file(at("elmstead", "shared.ts"));
  file(at("elmstead", "constraints.ts"));
  file(at("elmstead", "ground", "index.ts"));
  file(at("elmstead", "ground", "walls.ts"));
  file(at("elmstead", "revisions", "rear-extension.ts"));
  file(at("elmstead", "revisions", "rear-extension.constraints.ts"));
  file(at("elmstead", "revisions", "folder-revision", "index.ts"));
  file(at("elmstead", "revisions", "folder-revision", "walls.ts"));
  file(at("elmstead", "revisions", "shared", "helper.ts"));
  file(at("examples", "example-cottage", "index.ts"));
  file(at("examples", "example-cottage", "revisions", "lean-to.ts"));
  file(at("examples", "single.ts"));
  file(at("examples", "single.constraints.ts"));
  file(at("single.ts"));
  file(at("single.constraints.ts"));
  file(at("orphan", "helper.ts"));
  file(at("notes.md"));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("targetFor", () => {
  it("maps a folder model's files to the highest root, not a nested storey folder", () => {
    expect(targetFor(root, at("elmstead", "ground", "walls.ts"))).toBe(at("elmstead"));
    expect(targetFor(root, at("elmstead", "ground", "index.ts"))).toBe(at("elmstead"));
    expect(targetFor(root, at("elmstead", "index.ts"))).toBe(at("elmstead"));
    expect(targetFor(root, at("elmstead", "shared.ts"))).toBe(at("elmstead"));
    expect(targetFor(root, at("elmstead", "constraints.ts"))).toBe(at("elmstead"));
    expect(targetFor(root, at("examples", "example-cottage", "index.ts"))).toBe(at("examples", "example-cottage"));
  });

  it("maps a file revision and its constraints to the revision file", () => {
    expect(targetFor(root, at("elmstead", "revisions", "rear-extension.ts"))).toBe(
      at("elmstead", "revisions", "rear-extension.ts"),
    );
    expect(targetFor(root, at("elmstead", "revisions", "rear-extension.constraints.ts"))).toBe(
      at("elmstead", "revisions", "rear-extension.ts"),
    );
    expect(targetFor(root, at("examples", "example-cottage", "revisions", "lean-to.ts"))).toBe(
      at("examples", "example-cottage", "revisions", "lean-to.ts"),
    );
  });

  it("maps a folder revision and its helpers to the revision folder", () => {
    expect(targetFor(root, at("elmstead", "revisions", "folder-revision", "index.ts"))).toBe(
      at("elmstead", "revisions", "folder-revision"),
    );
    expect(targetFor(root, at("elmstead", "revisions", "folder-revision", "walls.ts"))).toBe(
      at("elmstead", "revisions", "folder-revision"),
    );
  });

  it("ignores shared revision helpers, unrelated helpers and non-TypeScript files", () => {
    expect(targetFor(root, at("elmstead", "revisions", "shared", "helper.ts"))).toBeUndefined();
    expect(targetFor(root, at("orphan", "helper.ts"))).toBeUndefined();
    expect(targetFor(root, at("notes.md"))).toBeUndefined();
    expect(targetFor(root, at("elmstead", "ground", "notes.md"))).toBeUndefined();
  });

  it("does not map a base model change to its revisions", () => {
    expect(targetFor(root, at("elmstead", "index.ts"))).toBe(at("elmstead"));
    expect(targetFor(root, at("elmstead", "revisions", "missing.ts"))).toBeUndefined();
  });

  it("maps a single-file model and its constraints, never the constraints as a model", () => {
    expect(targetFor(root, at("examples", "single.ts"))).toBe(at("examples", "single.ts"));
    expect(targetFor(root, at("examples", "single.constraints.ts"))).toBe(at("examples", "single.ts"));
    expect(targetFor(root, at("examples", "constraints.ts"))).toBeUndefined();
    expect(targetFor(root, at("single.ts"))).toBe(at("single.ts"));
    expect(targetFor(root, at("single.constraints.ts"))).toBe(at("single.ts"));
  });

  it("ignores paths outside models/", () => {
    expect(targetFor(root, join(root, "..", "notes.ts"))).toBeUndefined();
    expect(targetFor(join(root, "models"), at("elmstead", "index.ts"))).toBeUndefined();
  });
});

describe("scopeFor", () => {
  it("watches a model root, a folder revision or a revision file's folder", () => {
    expect(scopeFor(root, at("elmstead"))).toEqual({ roots: [at("elmstead")], targets: null });
    expect(scopeFor(root, at("elmstead", "revisions", "folder-revision"))).toEqual({
      roots: [at("elmstead", "revisions", "folder-revision")],
      targets: null,
    });
    expect(scopeFor(root, at("elmstead", "revisions", "rear-extension.ts"))).toEqual({
      roots: [at("elmstead", "revisions")],
      targets: new Set([at("elmstead", "revisions", "rear-extension.ts")]),
    });
    expect(scopeFor(root, at("elmstead", "revisions", "rear-extension.constraints.ts"))).toEqual({
      roots: [at("elmstead", "revisions")],
      targets: new Set([at("elmstead", "revisions", "rear-extension.ts")]),
    });
  });

  it("watches a single-file model through its directory, filtered to that model", () => {
    expect(scopeFor(root, at("examples", "single.ts"))).toEqual({
      roots: [at("examples")],
      targets: new Set([at("examples", "single.ts")]),
    });
    expect(scopeFor(root, at("examples", "single.constraints.ts"))).toEqual({
      roots: [at("examples")],
      targets: new Set([at("examples", "single.ts")]),
    });
    expect(scopeFor(root, at("single.ts"))).toEqual({
      roots: [root],
      targets: new Set([at("single.ts")]),
    });
    expect(scopeFor(root, at("single.constraints.ts"))).toEqual({
      roots: [root],
      targets: new Set([at("single.ts")]),
    });
  });

  it("watches a model helper's root and ignores paths it cannot resolve", () => {
    expect(scopeFor(root, at("elmstead", "ground", "walls.ts"))).toEqual({
      roots: [at("elmstead")],
      targets: null,
    });
    expect(scopeFor(root, at("elmstead", "ground"))).toBeUndefined();
    expect(scopeFor(root, at("elmstead", "revisions", "shared"))).toBeUndefined();
    expect(scopeFor(root, at("does-not-exist"))).toBeUndefined();
    expect(scopeFor(root, at("notes.md"))).toBeUndefined();
  });
});
