// Where a model's files live: its name, entry point and constraints file.
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/** The file name without its .ts/.js (or .mts, .cjs, ...) extension. */
const stripExt = (path: string): string => basename(path).replace(/\.[cm]?[jt]s$/, "");

/** A folder is a multi-file model; its entry point is index.ts. */
export const entryPoint = (path: string): string => (existsSync(path) && statSync(path).isDirectory() ? join(path, "index.ts") : path);

/**
 * Output name for a model: the file name without extension, or the folder name for a
 * multi-file model (`models/elmstead/index.ts` or just `models/elmstead`).
 */
export function modelName(path: string): string {
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
