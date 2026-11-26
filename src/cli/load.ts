import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { z } from "zod";
import type { Issue } from "../checks/issue.js";
import { RevisionError } from "../model/revise.js";
import { BuildingModelSchema, type BuildingModel } from "../schema/schema.js";

export interface LoadedModel {
  /** Model name, e.g. "example-cottage", or the folder name for a multi-file model. Used for out/<name>.* */
  name: string;
  model: BuildingModel;
}

export type LoadResult = { ok: true; value: LoadedModel } | { ok: false; issues: Issue[] };

/**
 * Output name for a model: the file name without extension, or the folder name for a
 * multi-file model (`models/elmstead/index.ts` or just `models/elmstead`).
 */
export function modelName(path: string): string {
  const name = basename(path).replace(/\.[cm]?[jt]s$/, "");
  return name === "index" ? basename(dirname(resolve(path))) : name;
}

/** A folder is a multi-file model; its entry point is index.ts. */
const entryPoint = (path: string): string => (existsSync(path) && statSync(path).isDirectory() ? join(path, "index.ts") : path);

/** Evaluate a model file, round-trip it through JSON, and validate it against the schema. */
export async function loadModel(path: string): Promise<LoadResult> {
  let exported: unknown;
  try {
    const mod = (await import(pathToFileURL(resolve(entryPoint(path))).href)) as { default?: unknown };
    exported = mod.default;
  } catch (e) {
    // A revision edit names the id it could not apply; report it there, like every other model error.
    if (e instanceof RevisionError) return { ok: false, issues: [{ level: "ERROR", id: e.id, message: `revision: ${e.message}` }] };
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

/** "storeys.0.walls.3.thickness: must be > 0", attributed to the nearest enclosing element id. */
export function schemaIssue(root: unknown, issue: z.core.$ZodIssue): Issue {
  let node: unknown = root;
  let id: string | undefined;
  for (const key of issue.path) {
    if (node && typeof node === "object") {
      node = (node as Record<PropertyKey, unknown>)[key as PropertyKey];
      const maybeId = node && typeof node === "object" ? (node as { id?: unknown }).id : undefined;
      if (typeof maybeId === "string") id = maybeId;
    }
  }
  return { level: "ERROR", ...(id ? { id } : {}), message: `schema: ${issue.path.join(".") || "(root)"}: ${issue.message}` };
}
