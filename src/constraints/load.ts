import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { schemaIssue, type Issue } from "../checks/issue.js";
import { constraintsPath, revisionOf } from "../paths.js";
import { RevisionError } from "../schema/ids.js";
import { CONSTRAINT_EDITS, type ConstraintEdits } from "./revise.js";
import { ConstraintsFileSchema, type ConstraintGroup } from "./schema.js";

export interface LoadedConstraints {
  /** The constraints file, relative to where the model path was given from. */
  path: string;
  groups: ConstraintGroup[];
  /**
   * For a revision: where its own constraints file is or would be, and, when that file revised the
   * base's with reviseConstraints, how. Without its own file a revision has its base's constraints.
   */
  revision?: { ownPath: string; edits?: ConstraintEdits };
}

/** `undefined` when the model has no constraints file. */
export type ConstraintsResult = { ok: true; value: LoadedConstraints | undefined } | { ok: false; path: string; issues: Issue[] };

/**
 * A model's constraints: its constraints file, evaluated, round-tripped through JSON and validated
 * as loadModel does for the model. A revision without its own file has its base model's.
 */
export async function loadConstraints(modelPath: string): Promise<ConstraintsResult> {
  const ownPath = constraintsPath(modelPath);
  const rev = revisionOf(modelPath);
  if (!rev || existsSync(ownPath)) {
    const own = await loadConstraintsFile(ownPath);
    if (!own.ok || !own.value || !rev) return own;
    return { ok: true, value: { ...own.value, revision: { ownPath, ...(own.edits ? { edits: own.edits } : {}) } } };
  }
  const inherited = await loadConstraintsFile(constraintsPath(rev.basePath));
  if (!inherited.ok || !inherited.value) return inherited;
  return { ok: true, value: { ...inherited.value, revision: { ownPath } } };
}

type FileResult = ConstraintsResult & { edits?: ConstraintEdits };

async function loadConstraintsFile(path: string): Promise<FileResult> {
  if (!existsSync(path)) return { ok: true, value: undefined };
  const fail = (message: string): FileResult => ({ ok: false, path, issues: [{ level: "ERROR", id: path, message }] });
  let exported: unknown;
  try {
    const mod = (await import(pathToFileURL(resolve(path)).href)) as { default?: unknown };
    exported = mod.default;
  } catch (e) {
    // A revision edit names the constraint it could not apply; report it there.
    if (e instanceof RevisionError) return { ok: false, path, issues: [{ level: "ERROR", id: e.id, message: `revision: ${e.message}` }] };
    return fail(`constraints threw while evaluating: ${e instanceof Error ? e.stack ?? e.message : e}`);
  }
  if (exported === undefined) return fail("constraints file has no default export");
  const edits = (exported as { [CONSTRAINT_EDITS]?: ConstraintEdits })[CONSTRAINT_EDITS];
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
  return { ok: true, value: { path, groups: parsed.data }, ...(edits ? { edits } : {}) };
}
