import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SHARED = join(ROOT, "src/shared");
const BACKEND = join(ROOT, "src/backend");
const FRONTEND = join(ROOT, "src/frontend");
const FRONTEND_VITE = join(FRONTEND, "vite");
const FRONTEND_VITE_CONFIG = join(FRONTEND, "vite.config.ts");

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      })
    : [];

const isInside = (path: string, dir: string): boolean => {
  const rel = relative(dir, path);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep);
};

const specifiers = (file: string): string[] => {
  const code = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const pattern of [/\bfrom\s+["']([^"']+)["']/g, /\bimport\(\s*["']([^"']+)["']\s*\)/g]) {
    for (const match of code.matchAll(pattern)) found.push(match[1]!);
  }
  return found;
};

const target = (file: string, spec: string): string | undefined =>
  spec.startsWith(".") ? resolve(dirname(file), spec) : undefined;

const violations = (files: readonly string[], forbidden: readonly string[], allow: (file: string) => boolean) =>
  files
    .filter((file) => /\.(ts|tsx)$/.test(file) && allow(file))
    .flatMap((file) =>
      specifiers(file).flatMap((spec) => {
        if (spec.startsWith("node:")) return [`${relative(ROOT, file)} imports ${spec}`];
        const resolved = target(file, spec);
        return resolved && forbidden.some((dir) => isInside(resolved, dir))
          ? [`${relative(ROOT, file)} imports ${spec}`]
          : [];
      }),
    );

describe("source boundaries", () => {
  it("keeps shared browser-safe", () => {
    expect(violations(walk(SHARED), [BACKEND, FRONTEND], () => true)).toEqual([]);
  });

  it("keeps browser frontend work out of Node and backend code", () => {
    expect(
      violations(walk(FRONTEND), [BACKEND], (file) => !isInside(file, FRONTEND_VITE) && file !== FRONTEND_VITE_CONFIG),
    ).toEqual([]);
  });
});
