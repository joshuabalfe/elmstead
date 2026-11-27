import { spawn } from "node:child_process";
import { join } from "node:path";
import { z } from "zod";
import type { Issue } from "../checks/issue.js";
import { PROJECT_ROOT } from "../root.js";

export interface IfcValidation {
  issues: Issue[];
  errors: number;
  warnings: number;
}

const ValidatorLineSchema = z.object({
  level: z.string().optional(),
  id: z.string().nullish(),
  entity: z.string().nullish(),
  message: z.string().optional(),
  errors: z.number().optional(),
  warnings: z.number().optional(),
});
type ValidatorLine = z.infer<typeof ValidatorLineSchema>;

const stderrTail = (stderr: string): string => stderr.trim().split("\n").slice(-5).join(" | ");

/** One stdout line as a typed validator line, or the message explaining why it is malformed. */
function parseValidatorLine(raw: string): { line: ValidatorLine } | { malformed: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { malformed: `validator output is not JSON: ${raw}` };
  }
  const result = ValidatorLineSchema.safeParse(parsed);
  return result.success ? { line: result.data } : { malformed: `validator line has an unexpected shape: ${raw}` };
}

/** The collected output as issues against `ifcPath`; `status` is null when a signal killed the validator. */
function parseOutput(ifcPath: string, stdout: string, stderr: string, status: number | null): IfcValidation {
  const issues: Issue[] = [];
  let summary: { errors: number; warnings: number } | undefined;
  let malformed = 0;
  for (const raw of stdout.split("\n")) {
    if (!raw.trim()) continue;
    const parsed = parseValidatorLine(raw);
    if ("malformed" in parsed) {
      malformed++;
      issues.push({ level: "ERROR", id: ifcPath, message: parsed.malformed });
      continue;
    }
    const { line } = parsed;
    if (line.level === "SUMMARY") {
      summary = { errors: line.errors ?? 0, warnings: line.warnings ?? 0 };
      continue;
    }
    const where = line.entity ? `${line.entity}: ` : "";
    issues.push({
      level: line.level === "ERROR" ? "ERROR" : "WARNING",
      ...(line.id ? { id: line.id } : {}),
      message: `ifc: ${where}${line.message ?? ""}`,
    });
  }
  const tail = stderrTail(stderr);
  if (!summary) {
    const issue: Issue = { level: "ERROR", id: ifcPath, message: `validator crashed (exit ${status}): ${tail}` };
    return {
      issues: [...issues, issue],
      errors: issues.filter((i) => i.level === "ERROR").length + 1,
      warnings: issues.filter((i) => i.level === "WARNING").length,
    };
  }
  if (status !== 0 && status !== 1) {
    issues.push({ level: "ERROR", id: ifcPath, message: `validator exited with status ${status}: ${tail}` });
    return { issues, errors: summary.errors + malformed + 1, warnings: summary.warnings };
  }
  // Exit 1 with a summary is normal: the summary already counts the findings.
  return { issues, errors: summary.errors + malformed, warnings: summary.warnings };
}

/** Runs validator/validate.py (IfcOpenShell) through uv and maps its JSON lines to Issues. */
export function validateIfc(ifcPath: string): Promise<IfcValidation> {
  return new Promise((resolve) => {
    const child = spawn("uv", ["run", "--quiet", join(PROJECT_ROOT, "validator/validate.py"), ifcPath], {
      cwd: PROJECT_ROOT,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const done = (v: IfcValidation) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d: string) => (stdout += d));
    child.stderr.on("data", (d: string) => (stderr += d));
    child.on("error", (e) => {
      const hint = (e as NodeJS.ErrnoException).code === "ENOENT" ? " — install it with: brew install uv" : "";
      done({ issues: [{ level: "ERROR", id: ifcPath, message: `could not run uv${hint}` }], errors: 1, warnings: 0 });
    });
    child.on("close", (status) => done(parseOutput(ifcPath, stdout, stderr, status)));
  });
}
