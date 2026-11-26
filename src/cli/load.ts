import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { schemaIssue, type Issue } from "../checks/issue.js";
import { entryPoint, modelName } from "../paths.js";
import { BuildingModelSchema, type BuildingModel } from "../schema/schema.js";

export interface LoadedModel {
  /** Model name, e.g. "example-cottage", or the folder name for a multi-file model. Used for out/<name>.* */
  name: string;
  model: BuildingModel;
}

export type LoadResult = { ok: true; value: LoadedModel } | { ok: false; issues: Issue[] };

/** Evaluate a model file, round-trip it through JSON, and validate it against the schema. */
export async function loadModel(path: string): Promise<LoadResult> {
  let exported: unknown;
  try {
    const mod = (await import(pathToFileURL(resolve(entryPoint(path))).href)) as { default?: unknown };
    exported = mod.default;
  } catch (e) {
    return { ok: false, issues: [{ level: "ERROR", id: path, message: `model threw while evaluating: ${e instanceof Error ? e.stack ?? e.message : e}` }] };
  }
  if (exported === undefined) {
    return { ok: false, issues: [{ level: "ERROR", id: path, message: "model has no default export" }] };
  }
  // The JSON round-trip makes sure what we validate is exactly what gets written.
  let json: unknown;
  try {
    json = JSON.parse(JSON.stringify(exported));
  } catch (e) {
    return { ok: false, issues: [{ level: "ERROR", id: path, message: `model cannot be written as JSON: ${e instanceof Error ? e.message : e}` }] };
  }
  const parsed = BuildingModelSchema.safeParse(json);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => schemaIssue(json, i)) };
  return { ok: true, value: { name: modelName(path), model: parsed.data } };
}
