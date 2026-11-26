/**
 * The CLI's Diff snapshots for a revision: drawn without removed elements, with a warning, until the
 * base is built, and in full after. Each render writes ten 3D pictures, so these are the slowest
 * CLI tests and have a file of their own. See cli.test.ts.
 */
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dirs, output, run, useCli } from "./support/cli.js";

useCli();

const rev = "models/examples/example-cottage/revisions/rear-extension.ts";

describe("CLI Diff snapshots", () => {
  it("warns when a revision's base isn't built", () => {
    const out = mkdtempSync(join(tmpdir(), "elmstead-cli-"));
    dirs.push(out);
    const env = { ELMSTEAD_OUT_DIR: out };
    expect(run(["build", rev], env).status).toBe(0);
    const alone = run(["render", rev], env);
    expect(alone.status, output(alone)).toBe(0);
    expect(output(alone)).toContain("Diff snapshots drawn without removed elements: no example-cottage.ifc yet");
  }, 600_000);

  it("snapshots a revision in Diff mode too, once its base is built", () => {
    const out = mkdtempSync(join(tmpdir(), "elmstead-cli-"));
    dirs.push(out);
    const env = { ELMSTEAD_OUT_DIR: out };
    expect(run(["build", rev], env).status).toBe(0);
    expect(run(["build", "models/examples/example-cottage"], env).status).toBe(0);
    const both = run(["render", rev], env);
    expect(both.status, output(both)).toBe(0);
    expect(output(both)).not.toContain("WARNING");
    const files = readdirSync(out);
    for (const view of ["sw", "se", "ne", "nw", "top"]) {
      expect(files).toContain(`example-cottage@rear-extension.3d-${view}.png`);
      expect(files).toContain(`example-cottage@rear-extension.3d-diff-${view}.png`);
    }
  }, 600_000);
});
