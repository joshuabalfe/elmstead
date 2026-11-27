/**
 * The heavy test files are named in three places that must agree: the CI matrix's groups, the
 * `--exclude` list of the matrix's `rest` group, and `test:fast`'s `--exclude` list. They drifted
 * apart twice (a new browser file ran in the fast job and made it take two minutes), so check them.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TEST_FILE = /tests\/[\w-]+\.test\.ts/g;
const files = (text: string | undefined) => [...new Set(text?.match(TEST_FILE) ?? [])].sort();

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const groups = new Map<string, string>();
for (const m of workflow.matchAll(/- group: (\S+)\n\s+args: ([\s\S]*?)(?=\n\s+- group:|\n    steps:)/g))
  groups.set(m[1]!, m[2]!);

const fast = JSON.parse(readFileSync("package.json", "utf8")).scripts["test:fast"] as string;

// Run by the matrix's `rest` group, but excluded from test:fast: they need uv or the CLI's Chromium.
const NEED_UV_OR_CHROMIUM = ["tests/ifc.test.ts", "tests/snapshot.test.ts", "tests/toolchain.test.ts"];

describe("CI test groups", () => {
  const named = [...groups]
    .filter(([g]) => g !== "rest")
    .flatMap(([, args]) => files(args))
    .sort();

  it("has a rest group, and no file in two groups", () => {
    expect(groups.has("rest")).toBe(true);
    expect(named.length).toBe(new Set(named).size);
  });

  it("names only files that exist", () => {
    expect([...named, ...files(fast)].filter((f) => !existsSync(f))).toEqual([]);
  });

  it("has rest exclude exactly the files the other groups run", () => {
    expect(files(groups.get("rest"))).toEqual(named);
  });

  it("has test:fast exclude those files, and the ones that need uv or Chromium, and nothing else", () => {
    expect(files(fast)).toEqual([...named, ...NEED_UV_OR_CHROMIUM].sort());
  });
});
