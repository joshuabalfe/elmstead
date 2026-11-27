import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateIfc, type IfcValidation } from "../src/ifc/validate.js";

/** Run validateIfc with a fake `uv` first on PATH. */
function withFakeUv(script: string): IfcValidation {
  const dir = mkdtempSync(join(tmpdir(), "elmstead-uv-"));
  const oldPath = process.env.PATH;
  try {
    const uv = join(dir, "uv");
    writeFileSync(uv, `#!/bin/sh\n${script}\n`);
    chmodSync(uv, 0o755);
    process.env.PATH = `${dir}:${oldPath ?? ""}`;
    return validateIfc("t.ifc");
  } finally {
    process.env.PATH = oldPath;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("validateIfc", () => {
  it("reports a non-JSON stdout line as an ERROR and still reads the summary", () => {
    const v = withFakeUv(
      `printf '%s\\n' 'warning: something changed'\nprintf '%s\\n' '{"level":"SUMMARY","errors":0,"warnings":0}'`,
    );
    expect(v.issues).toEqual([
      { level: "ERROR", id: "t.ifc", message: "validator output is not JSON: warning: something changed" },
    ]);
    expect([v.errors, v.warnings]).toEqual([1, 0]);
  });

  it("quotes truncated JSON instead of throwing", () => {
    const v = withFakeUv(
      `printf '%s\\n' '{"level":"ERROR","id":"wall'\nprintf '%s\\n' '{"level":"SUMMARY","errors":0,"warnings":0}'`,
    );
    expect(v.issues[0]).toMatchObject({ level: "ERROR", id: "t.ifc" });
    expect(v.issues[0]!.message).toContain('{"level":"ERROR","id":"wall');
    expect(v.errors).toBe(1);
  });

  it("reports valid JSON of the wrong shape as an ERROR and still reads the summary", () => {
    const v = withFakeUv(
      `printf '%s\\n' '[1]'\nprintf '%s\\n' '{"level":5}'\nprintf '%s\\n' '{"level":"SUMMARY","errors":2,"warnings":0}'\nexit 1`,
    );
    expect(v.issues).toEqual([
      { level: "ERROR", id: "t.ifc", message: "validator line has an unexpected shape: [1]" },
      { level: "ERROR", id: "t.ifc", message: 'validator line has an unexpected shape: {"level":5}' },
    ]);
    expect([v.errors, v.warnings]).toEqual([4, 0]);
  });

  it("counts a summary with no counts as zero errors and warnings", () => {
    const v = withFakeUv(`printf '%s\\n' '{"level":"SUMMARY"}'`);
    expect(v.issues).toEqual([]);
    expect([v.errors, v.warnings]).toEqual([0, 0]);
  });

  it("rejects a summary whose counts are not numbers, so the run counts as crashed", () => {
    const v = withFakeUv(`printf '%s\\n' '{"level":"SUMMARY","errors":"3","warnings":0}'`);
    expect(v.issues[0]!.message).toBe(
      'validator line has an unexpected shape: {"level":"SUMMARY","errors":"3","warnings":0}',
    );
    expect(v.issues.at(-1)!.message).toContain("validator crashed (exit 0)");
    expect(v.errors).toBe(2);
  });

  it("reports an unexpected exit status without a summary with stderr", () => {
    const v = withFakeUv(`printf '%s\\n' 'boom one' >&2\nprintf '%s\\n' 'boom two' >&2\nexit 2`);
    expect(v.issues.at(-1)!.message).toContain("validator crashed (exit 2)");
    expect(v.issues.at(-1)!.message).toContain("boom one");
    expect(v.errors).toBe(1);
  });

  it("accepts exit 1 when the summary reports findings", () => {
    const v = withFakeUv(
      `printf '%s\\n' '{"level":"ERROR","id":"wall-south","entity":null,"message":"bad"}'\nprintf '%s\\n' '{"level":"SUMMARY","errors":1,"warnings":0}'\nexit 1`,
    );
    expect(v.issues).toEqual([{ level: "ERROR", id: "wall-south", message: "ifc: bad" }]);
    expect([v.errors, v.warnings]).toEqual([1, 0]);
  });

  it("reports a non-0/1 exit even when a summary was printed", () => {
    const v = withFakeUv(
      `printf '%s\\n' '{"level":"SUMMARY","errors":0,"warnings":0}'\nprintf '%s\\n' 'internal error' >&2\nexit 3`,
    );
    expect(v.issues.at(-1)!.message).toContain("validator exited with status 3");
    expect(v.errors).toBe(1);
  });
});
