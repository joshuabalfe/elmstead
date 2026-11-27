import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { schemaIssue, type Issue } from "../checks/issue.js";
import { entryPoint, modelName, revisionOf } from "../paths.js";
import { RevisionError } from "../schema/ids.js";
import { BuildingModelSchema, type BuildingModel } from "../schema/schema.js";

export interface LoadedModel {
  /** Model name, e.g. "example-cottage", or the folder name for a multi-file model. Used for out/<name>.* */
  name: string;
  model: BuildingModel;
  /** For a revision: its base model, loaded from the folder the revision sits in. */
  base?: { path: string; model: BuildingModel };
}

export type LoadResult = { ok: true; value: LoadedModel } | { ok: false; issues: Issue[] };

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Evaluate a model file, round-trip it through JSON, and validate it against the schema. */
export async function loadModel(path: string): Promise<LoadResult> {
  const rev = revisionOf(path);
  if (rev && !KEBAB.test(rev.revision)) {
    return {
      ok: false,
      issues: [
        {
          level: "ERROR",
          id: path,
          message: `revision name "${rev.revision}" must be lower-case kebab-case, e.g. rear-extension`,
        },
      ],
    };
  }
  let exported: unknown;
  try {
    const mod = (await import(pathToFileURL(resolve(entryPoint(path))).href)) as { default?: unknown };
    exported = mod.default;
  } catch (e) {
    // A revision edit names the id it could not apply; report it there, like every other model error.
    if (e instanceof RevisionError)
      return { ok: false, issues: [{ level: "ERROR", id: e.id, message: `revision: ${e.message}` }] };
    return {
      ok: false,
      issues: [
        {
          level: "ERROR",
          id: path,
          message: `model threw while evaluating: ${e instanceof Error ? (e.stack ?? e.message) : e}`,
        },
      ],
    };
  }
  if (exported === undefined) {
    return { ok: false, issues: [{ level: "ERROR", id: path, message: "model has no default export" }] };
  }
  // The JSON round-trip makes sure what we validate is exactly what gets written.
  let json: unknown;
  try {
    json = JSON.parse(JSON.stringify(exported));
  } catch (e) {
    return {
      ok: false,
      issues: [
        { level: "ERROR", id: path, message: `model cannot be written as JSON: ${e instanceof Error ? e.message : e}` },
      ],
    };
  }
  const parsed = BuildingModelSchema.safeParse(json);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => schemaIssue(json, i)) };
  if (!rev) return { ok: true, value: { name: modelName(path), model: parsed.data } };
  const base = await loadModel(rev.basePath);
  if (!base.ok)
    return {
      ok: false,
      issues: [
        ...base.issues,
        { level: "ERROR", id: path, message: `the revision's base model, ${rev.basePath}, did not validate` },
      ],
    };
  const issues = storeyMismatches(base.value.model, parsed.data, rev.model);
  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: { name: modelName(path), model: parsed.data, base: { path: rev.basePath, model: base.value.model } },
  };
}

/** A revision keeps its base's storeys: one ERROR per storey it lacks or adds. */
function storeyMismatches(base: BuildingModel, revision: BuildingModel, baseName: string): Issue[] {
  const baseIds = new Set(base.storeys.map((s) => s.id));
  const revIds = new Set(revision.storeys.map((s) => s.id));
  return [
    ...[...baseIds]
      .filter((id) => !revIds.has(id))
      .map((id): Issue => ({
        level: "ERROR",
        id,
        message: `storey of ${baseName} is missing from the revision; a revision keeps its base's storeys`,
      })),
    ...[...revIds]
      .filter((id) => !baseIds.has(id))
      .map((id): Issue => ({
        level: "ERROR",
        id,
        message: `storey is not in ${baseName}; a revision keeps its base's storeys`,
      })),
  ];
}
