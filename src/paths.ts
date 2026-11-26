// Where a model's files live: its name, entry point and constraints file, and a revision's base.
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

/** The file name without its .ts/.js (or .mts, .cjs, ...) extension. */
const stripExt = (path: string): string => basename(path).replace(/\.[cm]?[jt]s$/, "");

/** A folder is a multi-file model; its entry point is index.ts. */
export const entryPoint = (path: string): string => (existsSync(path) && statSync(path).isDirectory() ? join(path, "index.ts") : path);

/** A revision's path, split into its base model and its own name. */
export interface RevisionPath {
  /** The base model's folder, relative to the working directory. */
  basePath: string;
  /** The base model's name, its folder name. */
  model: string;
  /** The revision's name, its file or folder name. */
  revision: string;
}

const isModule = (path: string): boolean => /\.[cm]?[jt]s$/.test(path);

/**
 * The revision a path names, or undefined for a model: `<folder>/revisions/<r>.ts`,
 * `<folder>/revisions/<r>/` or `<folder>/revisions/<r>/index.ts`, where `<folder>` is a folder model.
 */
export function revisionOf(path: string): RevisionPath | undefined {
  const abs = resolve(path);
  // The revision's own file or folder: index.ts stands for its folder.
  const entry = isModule(abs) && stripExt(abs) === "index" ? dirname(abs) : abs;
  const revisions = dirname(entry);
  if (basename(revisions) !== "revisions") return undefined;
  const base = dirname(revisions);
  if (!existsSync(join(base, "index.ts"))) return undefined;
  // A folder revision has an index.ts; a folder under revisions/ without one holds helpers.
  const asFolder = !isModule(abs) || entry !== abs;
  if (asFolder && !existsSync(join(entry, "index.ts"))) return undefined;
  return { basePath: relative(process.cwd(), base) || ".", model: basename(base), revision: asFolder ? basename(entry) : stripExt(abs) };
}

/**
 * Output name for a model: the file name without extension, or the folder name for a
 * multi-file model (`models/elmstead/index.ts` or just `models/elmstead`). A revision is named
 * `<model>@<revision>`.
 */
export function modelName(path: string): string {
  const rev = revisionOf(path);
  if (rev) return `${rev.model}@${rev.revision}`;
  const name = stripExt(path);
  return name === "index" ? basename(dirname(resolve(path))) : name;
}

/**
 * Where a model's constraints live: `constraints.ts` in a folder model (given as the folder or its
 * index.ts), `<name>.constraints.ts` beside a single-file model.
 */
export function constraintsPath(modelPath: string): string {
  const entry = entryPoint(modelPath);
  const name = stripExt(entry);
  return join(dirname(entry), name === "index" ? "constraints.ts" : `${name}.constraints.ts`);
}
