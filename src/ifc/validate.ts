import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Issue } from "../checks/issue.js";
import { PROJECT_ROOT } from "../root.js";

export interface IfcValidation {
  issues: Issue[];
  errors: number;
  warnings: number;
}

interface ValidatorLine {
  level?: string;
  id?: string | null;
  entity?: string | null;
  message?: string;
  errors?: number;
  warnings?: number;
}

const stderrTail = (stderr: string): string => stderr.trim().split("\n").slice(-5).join(" | ");

/** Runs validator/validate.py (IfcOpenShell) through uv and maps its JSON lines to Issues. */
export function validateIfc(ifcPath: string): IfcValidation {
  const r = spawnSync("uv", ["run", "--quiet", join(PROJECT_ROOT, "validator/validate.py"), ifcPath], { encoding: "utf8", cwd: PROJECT_ROOT });
  if (r.error) {
    const hint = (r.error as NodeJS.ErrnoException).code === "ENOENT" ? " — install it with: brew install uv" : "";
    return { issues: [{ level: "ERROR", id: ifcPath, message: `could not run uv${hint}` }], errors: 1, warnings: 0 };
  }
  const issues: Issue[] = [];
  let summary: { errors: number; warnings: number } | undefined;
  let malformed = 0;
  for (const raw of r.stdout.split("\n")) {
    if (!raw.trim()) continue;
    let line: ValidatorLine;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      line = parsed as ValidatorLine;
    } catch {
      malformed++;
      issues.push({ level: "ERROR", id: ifcPath, message: `validator output is not JSON: ${raw}` });
      continue;
    }
    if (line.level === "SUMMARY") {
      summary = { errors: Number(line.errors) || 0, warnings: Number(line.warnings) || 0 };
      continue;
    }
    const where = line.entity ? `${line.entity}: ` : "";
    issues.push({ level: line.level === "ERROR" ? "ERROR" : "WARNING", ...(line.id ? { id: line.id } : {}), message: `ifc: ${where}${line.message ?? ""}` });
  }
  const stderr = stderrTail(r.stderr);
  if (!summary) {
    const issue: Issue = { level: "ERROR", id: ifcPath, message: `validator crashed (exit ${r.status}): ${stderr}` };
    return {
      issues: [...issues, issue],
      errors: issues.filter((i) => i.level === "ERROR").length + 1,
      warnings: issues.filter((i) => i.level === "WARNING").length,
    };
  }
  if (r.status !== 0 && r.status !== 1) {
    issues.push({ level: "ERROR", id: ifcPath, message: `validator exited with status ${r.status}: ${stderr}` });
    return { issues, errors: summary.errors + malformed + 1, warnings: summary.warnings };
  }
  // Exit 1 with a summary is normal: the summary already counts the findings.
  return { issues, errors: summary.errors + malformed, warnings: summary.warnings };
}