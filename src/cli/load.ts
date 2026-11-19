import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { z } from "zod";
import type { Issue } from "../checks/issue.js";
import { BuildingModelSchema, type BuildingModel } from "../schema/schema.js";

export interface LoadedModel {
  /** File name without extension, e.g. "example-cottage". Used for out/<name>.* */
  name: string;
  model: BuildingModel;
}

export type LoadResult = { ok: true; value: LoadedModel } | { ok: false; issues: Issue[] };

export const modelName = (path: string): string => basename(path).replace(/\.[cm]?[jt]s$/, "");

/** Evaluate a model file, round-trip it through JSON, and validate it against the schema. */
export async function loadModel(path: string): Promise<LoadResult> {
  let exported: unknown;
  try {
    const mod = (await import(pathToFileURL(resolve(path)).href)) as { default?: unknown };
    exported = mod.default;
  } catch (e) {
    return { ok: false, issues: [{ level: "ERROR", id: path, message: `model threw while evaluating: ${(e as Error).stack ?? e}` }] };
  }
  if (exported === undefined) {
    return { ok: false, issues: [{ level: "ERROR", id: path, message: "model has no default export" }] };
  }
  // The JSON round-trip makes sure what we validate is exactly what gets written.
  const json: unknown = JSON.parse(JSON.stringify(exported));
  const parsed = BuildingModelSchema.safeParse(json);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((i) => schemaIssue(json, i)) };
  return { ok: true, value: { name: modelName(path), model: parsed.data } };
}

/** "storeys.0.walls.3.thickness: must be > 0", attributed to the nearest enclosing element id. */
function schemaIssue(root: unknown, issue: z.core.$ZodIssue): Issue {
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
