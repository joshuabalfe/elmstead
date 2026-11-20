import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "src/cli/index.ts");
const dirs: string[] = [];

interface Result {
  status: number | null;
  stdout: string;
  stderr: string;
  files: string[];
}

function run(args: string[], env: Record<string, string> = {}): Result {
  const out = mkdtempSync(join(tmpdir(), "elmstead-cli-"));
  dirs.push(out);
  const r = spawnSync(process.execPath, ["--import", "tsx", CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, ELMSTEAD_OUT_DIR: out, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, files: readdirSync(out).sort() };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const output = (r: Result): string => r.stdout + r.stderr;

describe("CLI", () => {
  it("builds a valid model into ELMSTEAD_OUT_DIR", () => {
    const r = run(["build", "models/example-cottage.ts"]);
    expect(r.status).toBe(0);
    expect(r.files).toEqual(["example-cottage.building.json", "example-cottage.ifc"]);
    expect(r.stdout).toContain("ifc");
    expect(r.stdout).toContain("valid");
  }, 120_000);

  it("writes nothing when a component check fails", () => {
    const r = run(["build", "tests/fixtures/bad-component.ts"]);
    expect(r.status).toBe(1);
    expect(output(r)).toContain("componentId door-type-missing is not in components");
    expect(r.files).toEqual([]);
  });

  it("reports a missing host wall as an issue, without a stack trace or partial output", () => {
    const r = run(["build", "tests/fixtures/missing-host.ts"]);
    expect(r.status).toBe(1);
    expect(output(r)).toContain("wallId wall-missing is not a wall on this storey");
    expect(output(r)).not.toMatch(/\n\s+at /);
    expect(r.files).toEqual([]);
  });

  it("reports a zero-length wall as an issue", () => {
    const r = run(["build", "tests/fixtures/zero-length-wall.ts"]);
    expect(r.status).toBe(1);
    expect(output(r)).toContain("zero-length wall cannot be written to IFC");
    expect(r.files).toEqual([]);
  });

  it("warns but still writes plans when render runs before build", () => {
    const r = run(["render", "models/example-cottage.ts"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("no IFC yet — run build first");
    expect(r.files).toEqual(["example-cottage.storey-ground.plan.png", "example-cottage.storey-ground.plan.svg"]);
  }, 120_000);

  it("checks a valid model without writing anything", () => {
    const r = run(["check", "models/example-cottage.ts"]);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("ERROR");
    expect(r.files).toEqual([]);
  });

  it("checks an invalid model and exits 1", () => {
    const r = run(["check", "tests/fixtures/missing-host.ts"]);
    expect(r.status).toBe(1);
    expect(output(r)).toContain("wallId wall-missing is not a wall on this storey");
    expect(r.files).toEqual([]);
  });

  it("runs build and render for all, skipping 3D when asked", () => {
    const r = run(["all", "models/example-cottage.ts", "--no-3d"]);
    expect(r.status).toBe(0);
    expect(r.files).toEqual([
      "example-cottage.building.json",
      "example-cottage.ifc",
      "example-cottage.storey-ground.plan.png",
      "example-cottage.storey-ground.plan.svg",
    ]);
  }, 120_000);

  it("stops all before rendering when the build fails", () => {
    const r = run(["all", "tests/fixtures/missing-host.ts", "--no-3d"]);
    expect(r.status).toBe(1);
    expect(r.files).toEqual([]);
  });
});