import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CHANGES = "openspec/changes";
const ARCHIVE = join(CHANGES, "archive");

const dirs = (path: string): string[] => readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory());

/** Every change folder, active and archived. Archiving adds a YYYY-MM-DD- prefix. */
const changes = (): { folder: string; name: string }[] => [
  ...dirs(CHANGES)
    .filter((name) => name !== "archive")
    .map((name) => ({ folder: join(CHANGES, name), name })),
  ...dirs(ARCHIVE).map((name) => ({ folder: join(ARCHIVE, name), name: name.replace(/^\d{4}-\d{2}-\d{2}-/, "") })),
];

const number = (name: string): number | undefined => {
  const match = /^elm-([1-9][0-9]*)-[a-z0-9]/.exec(name);
  return match ? Number(match[1]) : undefined;
};

describe("OpenSpec change numbers", () => {
  it("every change is named elm-<N>-<name>", () => {
    for (const { folder, name } of changes()) expect(number(name), `${folder} should be named elm-<N>-<name>`).toBeDefined();
  });

  it("no two changes share a number", () => {
    const seen = new Map<number, string>();
    for (const { folder, name } of changes()) {
      const n = number(name);
      if (n === undefined) continue;
      expect(seen.get(n), `${folder} reuses elm-${n}`).toBeUndefined();
      seen.set(n, folder);
    }
  });

  it("openspec/next-change-number is above every number in use", () => {
    const next = Number(readFileSync("openspec/next-change-number", "utf8").trim());
    expect(Number.isInteger(next) && next > 0, "openspec/next-change-number should hold a positive integer").toBe(true);
    for (const { folder, name } of changes()) {
      const n = number(name);
      if (n !== undefined) expect(n, `${folder} is not below openspec/next-change-number (${next})`).toBeLessThan(next);
    }
  });
});
