import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

// These tests spawn tsx subprocesses; under the full suite's WebGL tests they can exceed the
// 5 s default even though the subprocess itself has a 120 s limit.
vi.setConfig({ testTimeout: 120_000 });

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "src/cli/index.ts");
const dirs: string[] = [];

interface Result {
  status: number | null;
  stdout: string;
  stderr: string;
  out: string;
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
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out, files: readdirSync(out).sort() };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const output = (r: Result): string => r.stdout + r.stderr;

describe("CLI", () => {
  it("builds a valid model into ELMSTEAD_OUT_DIR", () => {
    const r = run(["build", "models/examples/example-cottage"]);
    expect(r.status).toBe(0);
    expect(r.files).toEqual(["example-cottage.building.json", "example-cottage.constraints.json", "example-cottage.ifc"]);
    expect(r.stdout).toContain("ifc");
    expect(r.stdout).toContain("valid");
  }, 120_000);

  it("publishes resolved constraints for the viewer", () => {
    const r = run(["build", "models/examples/example-cottage"]);
    expect(r.status).toBe(0);
    const list = JSON.parse(readFileSync(join(r.out, "example-cottage.constraints.json"), "utf8")) as {
      id: string;
      scope: string;
      storey: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
      span: { from: { x: number; y: number }; to: { x: number; y: number } };
      distance: number;
    }[];
    expect(list).toHaveLength(6);
    expect(list.find((c) => c.id === "living-width")).toEqual({
      id: "living-width",
      scope: "room-living",
      storey: "storey-ground",
      from: { x: 200, y: 200 },
      to: { x: 3750, y: 3350 },
      span: { from: { x: 200, y: 200 }, to: { x: 3750, y: 200 } },
      distance: 3550,
    });
  }, 120_000);

  it("writes no constraints JSON for a model without a constraints file", () => {
    const r = run(["build", "tests/fixtures/unconstrained.ts"]);
    expect(r.status).toBe(0);
    expect(r.files).toEqual(["unconstrained.building.json", "unconstrained.ifc"]);
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

  it("reports a stair landing its flights miss, and writes nothing", () => {
    const r = run(["build", "tests/fixtures/bad-stair.ts"]);
    expect(r.status).toBe(1);
    expect(output(r)).toContain("stair-landing-half: stair-flight-lower ends 100 mm away from this landing");
    expect(r.files).toEqual([]);
  });

  it("warns but still writes plans when render runs before build", () => {
    const r = run(["render", "models/examples/example-cottage"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("no IFC yet — run build first");
    expect(r.files).toEqual(["example-cottage.storey-ground.plan.png", "example-cottage.storey-ground.plan.svg"]);
  }, 120_000);

  it("checks a valid model without writing anything", () => {
    const r = run(["check", "models/examples/example-cottage"]);
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

  it("warns and keeps the plans when Chromium is missing", () => {
    const browsers = mkdtempSync(join(tmpdir(), "elmstead-no-chromium-"));
    dirs.push(browsers);
    const r = run(["all", "models/examples/example-cottage"], { PLAYWRIGHT_BROWSERS_PATH: browsers });
    expect(r.status).toBe(0);
    expect(output(r)).toContain("3D snapshots skipped: Chromium missing");
    expect(r.files).toContain("example-cottage.storey-ground.plan.png");
    expect(r.files.some((f) => f.includes(".3d-"))).toBe(false);
  }, 120_000);

  it("runs build and render for all, skipping 3D when asked", () => {
    const r = run(["all", "models/examples/example-cottage", "--no-3d"]);
    expect(r.status).toBe(0);
    expect(r.files).toEqual([
      "example-cottage.building.json",
      "example-cottage.constraints.json",
      "example-cottage.ifc",
      "example-cottage.storey-ground.plan.png",
      "example-cottage.storey-ground.plan.svg",
    ]);
  }, 120_000);

  it("builds a file revision under <model>@<revision>, leaving the base's outputs alone", () => {
    const r = run(["build", "tests/fixtures/revised/revisions/no-kitchen-window.ts"]);
    expect(r.status, output(r)).toBe(0);
    expect(r.files).toContain("revised@no-kitchen-window.building.json");
    expect(r.files).toContain("revised@no-kitchen-window.ifc");
    expect(r.files.filter((f) => !f.startsWith("revised@no-kitchen-window."))).toEqual([]);
    expect(r.stdout).toContain("geom    ");
    expect(r.stdout).toMatch(/valid   .*revised@no-kitchen-window\.ifc: 0 errors/);
    const json = JSON.parse(readFileSync(join(r.out, "revised@no-kitchen-window.building.json"), "utf8")) as { storeys: { openings: { id: string }[] }[] };
    expect(json.storeys[0]!.openings.map((o) => o.id)).not.toContain("window-kitchen");
  }, 120_000);

  it("builds and renders a folder revision, plans and snapshots named after it", () => {
    const r = run(["all", "tests/fixtures/revised/revisions/lean-to"]);
    expect(r.status, output(r)).toBe(0);
    expect(r.files).toContain("revised@lean-to.building.json");
    expect(r.files).toContain("revised@lean-to.ifc");
    expect(r.files).toContain("revised@lean-to.storey-ground.plan.svg");
    expect(r.files).toContain("revised@lean-to.3d-top.png");
    expect(r.files.filter((f) => !f.startsWith("revised@lean-to."))).toEqual([]);
  }, 180_000);

  it("rejects a revision whose storeys differ from its base's, writing nothing", () => {
    const r = run(["build", "tests/fixtures/revised/revisions/extra-storey.ts"]);
    expect(r.status).toBe(1);
    expect(output(r)).toContain("ERROR   storey-loft: storey is not in revised; a revision keeps its base's storeys");
    expect(r.files).toEqual([]);
  });

  it("checks a revision against its base's constraints when it has none of its own", () => {
    const r = run(["check", "tests/fixtures/revised/revisions/no-kitchen-window.ts"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("constr  tests/fixtures/revised/constraints.ts: 6 of 6 met\n");
  });

  it("fails a revision that breaks an inherited constraint, naming where to revise it", () => {
    const r = run(["build", "tests/fixtures/revised/revisions/no-east-wall.ts"]);
    expect(r.status).toBe(1);
    expect(output(r)).toContain(
      "ERROR   bathroom-corner-to-window-centre: wall-east is not in the model (room-bathroom); the revision can remove or replace it in tests/fixtures/revised/revisions/no-east-wall.constraints.ts",
    );
    expect(r.files).toEqual([]);
  });

  it("checks a revision's own constraints, counting its edits, and publishes them", () => {
    const r = run(["build", "tests/fixtures/revised/revisions/wide-window-revised"]);
    expect(r.status, output(r)).toBe(0);
    expect(r.stdout).toContain("constr  tests/fixtures/revised/revisions/wide-window-revised/constraints.ts: 6 of 6 met (1 removed, 1 replaced, 1 added)");
    const list = JSON.parse(readFileSync(join(r.out, "revised@wide-window-revised.constraints.json"), "utf8")) as { id: string; distance: number }[];
    expect(list.map((c) => c.id)).toContain("living-window-from-east");
    expect(list.map((c) => c.id)).not.toContain("living-corner-to-window");
    expect(list.find((c) => c.id === "living-window-width")!.distance).toBe(1800);
  }, 120_000);

  it("reports a revision constraint edit that cannot be applied against its id", () => {
    const r = run(["check", "tests/fixtures/revised/revisions/unnoted.ts"]);
    expect(r.status).toBe(1);
    expect(output(r)).toContain("ERROR   hall-width: revision: cannot remove constraint hall-width: say why in its note");
    expect(output(r)).toContain("FAILED  tests/fixtures/revised/revisions/unnoted.constraints.ts: constraints did not validate");
  });

  it("writes a revision's diff, file or folder, and none for a base model", () => {
    const file = run(["build", "models/examples/example-cottage/revisions/rear-extension.ts"]);
    expect(file.status, output(file)).toBe(0);
    const diff = JSON.parse(readFileSync(join(file.out, "example-cottage@rear-extension.diff.json"), "utf8")) as { base: string; revision: string; added: { id: string }[]; removed: { id: string }[]; changed: { id: string }[] };
    expect(diff.base).toBe("example-cottage");
    expect(diff.revision).toBe("example-cottage@rear-extension");
    expect(diff.removed.map((e) => e.id)).toEqual(["wall-living-kitchen", "window-kitchen", "room-kitchen"]);
    expect(diff.changed.map((e) => e.id)).toEqual(["window-living", "room-living"]);
    const folder = run(["build", "tests/fixtures/revised/revisions/lean-to"]);
    expect(folder.files).toContain("revised@lean-to.diff.json");
    const base = run(["build", "models/examples/example-cottage"]);
    expect(base.files.some((f) => f.endsWith(".diff.json"))).toBe(false);
  }, 180_000);

  it("writes a byte-identical diff on every build", () => {
    const a = run(["build", "tests/fixtures/revised/revisions/no-kitchen-window.ts"]);
    const b = run(["build", "tests/fixtures/revised/revisions/no-kitchen-window.ts"]);
    const read = (r: Result) => readFileSync(join(r.out, "revised@no-kitchen-window.diff.json"), "utf8");
    expect(read(a)).toBe(read(b));
  }, 180_000);

  it("leaves an earlier diff file alone when a revision's build fails", () => {
    const out = mkdtempSync(join(tmpdir(), "elmstead-cli-"));
    dirs.push(out);
    const earlier = join(out, "revised@no-east-wall.diff.json");
    writeFileSync(earlier, "earlier\n");
    const r = run(["build", "tests/fixtures/revised/revisions/no-east-wall.ts"], { ELMSTEAD_OUT_DIR: out });
    expect(r.status).toBe(1);
    expect(readFileSync(earlier, "utf8")).toBe("earlier\n");
  });

  it("prints the diff summary for a revision in build, check and all, without changing the exit status", () => {
    const line = "diff    example-cottage@rear-extension: 6 added, 2 changed, 3 removed\n";
    for (const command of ["check", "build"]) {
      const r = run([command, "models/examples/example-cottage/revisions/rear-extension.ts"]);
      expect(r.status, command).toBe(0);
      expect(r.stdout.split(line).length - 1, command).toBe(1);
    }
    const all = run(["all", "models/examples/example-cottage/revisions/rear-extension.ts", "--no-3d"]);
    expect(all.stdout.split(line).length - 1).toBe(1);
    expect(run(["check", "models/examples/example-cottage"]).stdout).not.toContain("diff    ");
  }, 240_000);

  it("snapshots a revision in Diff mode too, and warns when its base isn't built", () => {
    const out = mkdtempSync(join(tmpdir(), "elmstead-cli-"));
    dirs.push(out);
    const env = { ELMSTEAD_OUT_DIR: out };
    const rev = "models/examples/example-cottage/revisions/rear-extension.ts";
    expect(run(["build", rev], env).status).toBe(0);
    const alone = run(["render", rev], env);
    expect(alone.status, output(alone)).toBe(0);
    expect(output(alone)).toContain("Diff snapshots drawn without removed elements: no example-cottage.ifc yet");
    expect(run(["build", "models/examples/example-cottage"], env).status).toBe(0);
    const both = run(["render", rev], env);
    expect(both.status, output(both)).toBe(0);
    expect(output(both)).not.toContain("WARNING");
    const files = readdirSync(out);
    for (const view of ["sw", "se", "ne", "nw", "top"]) {
      expect(files).toContain(`example-cottage@rear-extension.3d-${view}.png`);
      expect(files).toContain(`example-cottage@rear-extension.3d-diff-${view}.png`);
    }
    const base = run(["render", "models/examples/example-cottage"], env);
    expect(base.status).toBe(0);
    expect(readdirSync(out).filter((f) => f.startsWith("example-cottage.3d-diff-"))).toEqual([]);
  }, 600_000);

  it("checks the model's constraints and prints how many were met", () => {
    const r = run(["check", "models/examples/example-cottage"]);
    expect(r.stdout).toContain("constr  models/examples/example-cottage/constraints.ts: 6 of 6 met");
  });

  it("prints no constraints line for a model without a constraints file", () => {
    const r = run(["check", "tests/fixtures/unconstrained.ts"]);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("constr");
  });

  it("writes nothing when the model breaks a constraint", () => {
    const r = run(["build", "tests/fixtures/broken-constraint.ts"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("ERROR   living-window-width: is 1200 mm, should be 1100 ±10 mm (room-living)");
    expect(r.stdout).toContain("constr  tests/fixtures/broken-constraint.constraints.ts: 0 of 1 met");
    expect(r.files).toEqual([]);
  });

  it("reports model check and constraint errors together", () => {
    const r = run(["check", "tests/fixtures/broken-model-and-constraints.ts"]);
    expect(r.status).toBe(1);
    expect(r.stdout.match(/^ERROR /gm)).toHaveLength(3);
    expect(r.stdout).toContain("wallId wall-missing is not a wall on this storey");
    expect(r.stdout).toContain("ERROR   too-narrow: is 1200 mm, should be 1100 ±10 mm (room-living)");
    expect(r.stdout).toContain("ERROR   too-wide: is 1200 mm, should be 1300 ±10 mm (room-living)");
  });

  it("names the constraints file when it fails to load", () => {
    const r = run(["build", "tests/fixtures/constraints-throws.ts"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FAILED  tests/fixtures/constraints-throws.constraints.ts: constraints did not validate");
    expect(r.stdout).not.toContain("model did not validate");
    expect(r.files).toEqual([]);
  });

  it("checks constraints once in all", () => {
    const r = run(["all", "models/examples/example-cottage", "--no-3d"]);
    expect(r.status).toBe(0);
    expect(r.stdout.match(/^constr /gm)).toHaveLength(1);
  }, 120_000);

  it("writes the same JSON and IFC with or without constraints", () => {
    const withC = run(["build", "tests/fixtures/same-name/with/example-cottage"]);
    const withoutC = run(["build", "tests/fixtures/same-name/without/example-cottage"]);
    expect(withC.stdout).toContain("6 of 6 met");
    expect(withC.files).toContain("example-cottage.constraints.json");
    expect(withoutC.stdout).not.toContain("constr");
    expect(withoutC.files).not.toContain("example-cottage.constraints.json");
    for (const file of ["example-cottage.building.json", "example-cottage.ifc"]) {
      expect(readFileSync(join(withC.out, file)).equals(readFileSync(join(withoutC.out, file))), file).toBe(true);
    }
  }, 240_000);

  it("stops all before rendering when the build fails", () => {
    const r = run(["all", "tests/fixtures/missing-host.ts", "--no-3d"]);
    expect(r.status).toBe(1);
    expect(r.files).toEqual([]);
  });
});