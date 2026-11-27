/**
 * The watch command's process glue: a real atomic save builds the model into a temporary output
 * folder, SIGTERM exits cleanly, and an unknown path exits 2. The source-to-target mapping and the
 * debounce queue are unit-tested separately.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PROJECT_ROOT } from "../src/backend/root.js";

const MODEL = "models/examples/example-cottage";
const SOURCE = join(PROJECT_ROOT, MODEL, "index.ts");

let out: string;
let original: string;

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), "elmstead-watch-command-"));
  original = readFileSync(SOURCE, "utf8");
});

afterAll(() => {
  writeFileSync(`${SOURCE}.restore`, original);
  renameSync(`${SOURCE}.restore`, SOURCE);
  rmSync(out, { recursive: true, force: true });
});

interface Running {
  child: ChildProcess;
  output: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

function start(args: string[]): Running {
  const child = spawn(process.execPath, ["--import", "tsx", join(PROJECT_ROOT, "scripts/watch.ts"), ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ELMSTEAD_OUT_DIR: out },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let text = "";
  child.stdout?.on("data", (chunk) => (text += String(chunk)));
  child.stderr?.on("data", (chunk) => (text += String(chunk)));
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  return { child, output: () => text, exited };
}

async function waitFor(test: () => boolean, label: string, timeout = 240_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (test()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function atomicSave(text: string): void {
  const tmp = `${SOURCE}.watch-test`;
  writeFileSync(tmp, text);
  renameSync(tmp, SOURCE);
}

describe("watch command", () => {
  it("builds an atomically saved model and exits cleanly on SIGTERM", async () => {
    const run = start([MODEL]);
    try {
      await waitFor(() => run.output().includes("watch   watching"), "the watcher to start");
      atomicSave(original);
      await waitFor(() => run.output().includes(`watch   built ${MODEL}`), "the build to finish");
      expect(existsSync(join(out, "example-cottage.ifc"))).toBe(true);
    } finally {
      run.child.kill("SIGTERM");
    }
    const { code } = await run.exited;
    expect(code).toBe(0);
  }, 300_000);

  it("prints the usage and exits 2 for a path that is not a model", async () => {
    const run = start(["models/does-not-exist"]);
    const { code } = await run.exited;
    expect(code).toBe(2);
    expect(run.output()).toContain("usage: npm run watch");
  }, 30_000);
});
