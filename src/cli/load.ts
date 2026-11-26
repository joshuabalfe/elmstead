import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { z } from "zod";
import type { Issue } from "../checks/issue.js";
import { RevisionError } from "../model/revise.js";
import { BuildingModelSchema, type BuildingModel } from "../schema/schema.js";

export interface LoadedModel {
  /** Model name, e.g. "example-cottage", or the folder name for a multi-file model. Used for out/<name>.* */
  name: string;
  model: BuildingModel;
  /** For a revision: its base model, loaded from the folder the revision sits in. */
  base?: { path: string; model: BuildingModel };
}

export type LoadResult = { ok: true; value: LoadedModel } | { ok: false; issues: Issue[] };

const stripExt = (file: string): string => file.replace(/\.[cm]?[jt]s$/, "");

/** A revision's path, split into its base model and its own name. */
export interface RevisionPath {
  /** The base model's folder, relative to the working directory. */
  basePath: string;
  /** The base model's name, its folder name. */
  model: string;
  /** The revision's name, its file or folder name. */
  revision: string;
}

/**
 * The revision a path names, or undefined for a model: `<folder>/revisions/<r>.ts`,
 * `<folder>/revisions/<r>/` or `<folder>/revisions/<r>/index.ts`, where `<folder>` is a folder model.
 */
export function revisionOf(path: string): RevisionPath | undefined {
  const abs = resolve(path);
  const file = basename(abs);
  const isFile = /\.[cm]?[jt]s$/.test(file);
  // The revision's own file or folder: index.ts stands for its folder.
  const entry = isFile && stripExt(file) === "index" ? dirname(abs) : abs;
  const revisions = dirname(entry);
  if (basename(revisions) !== "revisions") return undefined;
  const base = dirname(revisions);
  if (!existsSync(join(base, "index.ts"))) return undefined;
  // A folder revision has an index.ts; a folder under revisions/ without one holds helpers.
  const asFolder = !isFile || entry !== abs;
  if (asFolder && !existsSync(join(entry, "index.ts"))) return undefined;
  return { basePath: relative(process.cwd(), base) || ".", model: basename(base), revision: asFolder ? basename(entry) : stripExt(file) };
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Output name for a model: the file name without extension, or the folder name for a
 * multi-file model (`models/elmstead/index.ts` or just `models/elmstead`). A revision is named
 * `<model>@<revision>`.
 */
export function modelName(path: string): string {
  const rev = revisionOf(path);
  if (rev) return `${rev.model}@${rev.revision}`;
  const name = stripExt(basename(path));
  return name === "index" ? basename(dirname(resolve(path))) : name;
}

/** A folder is a multi-file model; its entry point is index.ts. */
const entryPoint = (path: string): string => (existsSync(path) && statSync(path).isDirectory() ? join(path, "index.ts") : path);

/** Evaluate a model file, round-trip it through JSON, and validate it against the schema. */
export async function loadModel(path: string): Promise<LoadResult> {
  const rev = revisionOf(path);
  if (rev && !KEBAB.test(rev.revision)) {
    return { ok: false, issues: [{ level: "ERROR", id: path, message: `revision name "${rev.revision}" must be lower-case kebab-case, e.g. rear-extension` }] };
  }
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
  if (!rev) return { ok: true, value: { name: modelName(path), model: parsed.data } };
  const base = await loadModel(rev.basePath);
  if (!base.ok) return { ok: false, issues: [...base.issues, { level: "ERROR", id: path, message: `the revision's base model, ${rev.basePath}, did not validate` }] };
  const issues = storeyMismatches(base.value.model, parsed.data, rev.model);
  if (issues.length) return { ok: false, issues };
  return { ok: true, value: { name: modelName(path), model: parsed.data, base: { path: rev.basePath, model: base.value.model } } };
}

/** A revision keeps its base's storeys: one ERROR per storey it lacks or adds. */
function storeyMismatches(base: BuildingModel, revision: BuildingModel, baseName: string): Issue[] {
  const baseIds = new Set(base.storeys.map((s) => s.id));
  const revIds = new Set(revision.storeys.map((s) => s.id));
  return [
    ...[...baseIds].filter((id) => !revIds.has(id)).map((id): Issue => ({ level: "ERROR", id, message: `storey of ${baseName} is missing from the revision; a revision keeps its base's storeys` })),
    ...[...revIds].filter((id) => !baseIds.has(id)).map((id): Issue => ({ level: "ERROR", id, message: `storey is not in ${baseName}; a revision keeps its base's storeys` })),
  ];
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
