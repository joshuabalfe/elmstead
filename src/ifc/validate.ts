import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Issue } from "../checks/issue.js";
import { PROJECT_ROOT } from "../root.js";

export interface IfcValidation {
  issues: Issue[];
  errors: number;
  warnings: number;
}

/** Runs validator/validate.py (IfcOpenShell) through uv and maps its JSON lines to Issues. */
export function validateIfc(ifcPath: string): IfcValidation {
  const r = spawnSync("uv", ["run", "--quiet", join(PROJECT_ROOT, "validator/validate.py"), ifcPath], { encoding: "utf8", cwd: PROJECT_ROOT });
  if (r.error) {
    const hint = (r.error as NodeJS.ErrnoException).code === "ENOENT" ? " — install it with: brew install uv" : "";
    return { issues: [{ level: "ERROR", id: ifcPath, message: `could not run uv${hint}` }], errors: 1, warnings: 0 };
  }
  const issues: Issue[] = [];
  let summary: { errors: number; warnings: number } | undefined;
  for (const raw of r.stdout.split("\n")) {
    if (!raw.trim()) continue;
    const line = JSON.parse(raw) as { level: string; id?: string | null; entity?: string | null; message?: string; errors?: number; warnings?: number };
    if (line.level === "SUMMARY") {
      summary = { errors: line.errors ?? 0, warnings: line.warnings ?? 0 };
      continue;
    }
    const where = line.entity ? `${line.entity}: ` : "";
    issues.push({ level: line.level === "ERROR" ? "ERROR" : "WARNING", ...(line.id ? { id: line.id } : {}), message: `ifc: ${where}${line.message ?? ""}` });
  }
  if (!summary) {
    const stderr = r.stderr.trim().split("\n").slice(-5).join(" | ");
    return { issues: [...issues, { level: "ERROR", id: ifcPath, message: `validator crashed (exit ${r.status}): ${stderr}` }], errors: issues.length + 1, warnings: 0 };
  }
  return { issues, ...summary };
}
