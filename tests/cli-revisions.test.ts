/** The CLI's revision tests: building, checking and rendering revisions, and their diffs. See cli.test.ts. */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dirs, output, run, useCli, type Result } from "./support/cli.js";

useCli();

describe("CLI revisions", () => {
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
    expect(diff.changed.map((e) => e.id)).toEqual(["wall-bedroom-bathroom", "door-bedroom", "door-bathroom", "window-living", "room-living", "room-bedroom", "room-bathroom"]);
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
    const line = "diff    example-cottage@rear-extension: 6 added, 7 changed, 3 removed\n";
    for (const command of ["check", "build"]) {
      const r = run([command, "models/examples/example-cottage/revisions/rear-extension.ts"]);
      expect(r.status, command).toBe(0);
      expect(r.stdout.split(line).length - 1, command).toBe(1);
    }
    const all = run(["all", "models/examples/example-cottage/revisions/rear-extension.ts", "--no-3d"]);
    expect(all.stdout.split(line).length - 1).toBe(1);
    expect(run(["check", "models/examples/example-cottage"]).stdout).not.toContain("diff    ");
  }, 240_000);
});
