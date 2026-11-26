import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { schemaIssue, type Issue } from "../checks/issue.js";
import { constraintsPath } from "../paths.js";
import { ConstraintsFileSchema, type ConstraintGroup } from "./schema.js";

export interface LoadedConstraints {
  /** The constraints file, relative to where the model path was given from. */
  path: string;
  groups: ConstraintGroup[];
}

/** `undefined` when the model has no constraints file. */
export type ConstraintsResult = { ok: true; value: LoadedConstraints | undefined } | { ok: false; path: string; issues: Issue[] };

/** Evaluate a model's constraints file, round-trip it through JSON and validate it, as loadModel does for the model. */
export async function loadConstraints(modelPath: string): Promise<ConstraintsResult> {
  const path = constraintsPath(modelPath);
  if (!existsSync(path)) return { ok: true, value: undefined };
  const fail = (message: string): ConstraintsResult => ({ ok: false, path, issues: [{ level: "ERROR", id: path, message }] });
  let exported: unknown;
  try {
    const mod = (await import(pathToFileURL(resolve(path)).href)) as { default?: unknown };
    exported = mod.default;
  } catch (e) {
    return fail(`constraints threw while evaluating: ${e instanceof Error ? e.stack ?? e.message : e}`);
  }
  if (exported === undefined) return fail("constraints file has no default export");
  let json: unknown;
  try {
    json = JSON.parse(JSON.stringify(exported));
  } catch (e) {
    return fail(`constraints cannot be written as JSON: ${e instanceof Error ? e.message : e}`);
  }
  const parsed = ConstraintsFileSchema.safeParse(json);
  if (!parsed.success) {
    // Attributed to the constraint the error is in, or to the file when it is outside any constraint.
    return { ok: false, path, issues: parsed.error.issues.map((i) => ({ id: path, ...schemaIssue(json, i) })) };
  }
  const seen = new Set<string>();
  const duplicates: Issue[] = [];
  for (const c of parsed.data.flatMap((g) => g.constraints)) {
    if (seen.has(c.id)) duplicates.push({ level: "ERROR", id: c.id, message: "constraint id is used twice" });
    seen.add(c.id);
  }
  if (duplicates.length) return { ok: false, path, issues: duplicates };
  return { ok: true, value: { path, groups: parsed.data } };
}
