/** What the CLI tests share: running the CLI in a subprocess against a temporary out/ folder. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, vi } from "vitest";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const CLI = join(ROOT, "src/backend/cli/index.ts");
/** Temp directories to remove after each test. */
export const dirs: string[] = [];

export interface Result {
  status: number | null;
  stdout: string;
  stderr: string;
  out: string;
  files: string[];
}

export function run(args: string[], env: Record<string, string> = {}): Result {
  const out = mkdtempSync(join(tmpdir(), "elmstead-cli-"));
  dirs.push(out);
  const r = spawnSync(process.execPath, ["--import", "tsx", CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, ELMSTEAD_OUT_DIR: out, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out, files: readdirSync(out).sort() };
}

export const output = (r: Result): string => r.stdout + r.stderr;

/** Call once at the top of a test file: long timeouts for the subprocesses, and temp dirs removed after each test. */
export function useCli() {
  // These tests spawn tsx subprocesses; under the full suite's WebGL tests they can exceed the
  // 5 s default even though the subprocess itself has a 120 s limit.
  vi.setConfig({ testTimeout: 120_000 });
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
}
