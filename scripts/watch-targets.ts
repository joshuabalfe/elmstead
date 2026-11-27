import { existsSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const MODULE_EXT = /\.[cm]?[jt]s$/;
const CONSTRAINTS = ".constraints.ts";

/** The path `child` relative to `parent`, or undefined when it is not inside it. */
function inside(parent: string, child: string): string | undefined {
  const rel = relative(parent, child);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return undefined;
  return rel;
}

/**
 * The model or revision a changed source file belongs to: a folder model, a single-file model, a
 * file revision (`revisions/<name>.ts`) or a folder revision (`revisions/<name>/index.ts`).
 * Undefined for shared revision helpers, unrelated helpers and anything outside `models/`.
 */
export function targetFor(modelsRoot: string, changed: string): string | undefined {
  const root = resolve(modelsRoot);
  const abs = resolve(changed);
  const rel = inside(root, abs);
  if (!rel || !MODULE_EXT.test(abs)) return undefined;

  const segments = rel.split(sep);
  let modelRoot: string | undefined;
  let dir = root;
  for (const segment of segments.slice(0, -1)) {
    dir = join(dir, segment);
    if (!modelRoot && existsSync(join(dir, "index.ts"))) modelRoot = dir;
  }

  if (modelRoot) {
    const parts = relative(modelRoot, abs).split(sep);
    if (parts[0] === "revisions") {
      const second = parts[1];
      if (!second) return undefined;
      if (MODULE_EXT.test(second)) {
        const name = second.endsWith(CONSTRAINTS)
          ? second.slice(0, -CONSTRAINTS.length)
          : second.replace(MODULE_EXT, "");
        const target = join(modelRoot, "revisions", `${name}.ts`);
        return existsSync(target) ? target : undefined;
      }
      const revisionDir = join(modelRoot, "revisions", second);
      return existsSync(join(revisionDir, "index.ts")) ? revisionDir : undefined;
    }
    return modelRoot;
  }

  // A single-file model sits directly under models/ or models/examples/; its constraints file
  // belongs to it rather than being a model of its own.
  if (segments.length > 2) return undefined;
  const parent = dirname(abs);
  if (parent !== root && parent !== join(root, "examples")) return undefined;
  const name = basename(abs);
  if (name === "constraints.ts") return undefined;
  if (name.endsWith(CONSTRAINTS)) {
    const target = join(parent, `${name.slice(0, -CONSTRAINTS.length)}.ts`);
    return existsSync(target) ? target : undefined;
  }
  return abs;
}

/** A filesystem watch and the targets under it that may start a build. */
export interface WatchScope {
  /** Directories to watch recursively. */
  roots: string[];
  /** Targets allowed to build, or null for every target under the roots. */
  targets: Set<string> | null;
}

/** The watch a path argument asks for: a model root, a revision folder or one revision file. */
export function scopeFor(modelsRoot: string, path: string): WatchScope | undefined {
  const root = resolve(modelsRoot);
  const abs = resolve(path);
  let stats;
  try {
    stats = statSync(abs);
  } catch {
    return undefined;
  }
  if (stats.isDirectory()) {
    if (!existsSync(join(abs, "index.ts"))) return undefined;
    // Only a model root or a folder revision; a nested storey folder belongs to its model.
    return targetFor(root, join(abs, "index.ts")) === abs ? { roots: [abs], targets: null } : undefined;
  }
  if (!MODULE_EXT.test(abs)) return undefined;
  const target = targetFor(root, abs);
  if (!target) return undefined;
  if (target === abs) return { roots: [dirname(abs)], targets: new Set([target]) };
  // A file revision is watched through revisions/ so an atomic save is noticed, but only that
  // revision builds.
  if (basename(dirname(abs)) === "revisions") return { roots: [dirname(abs)], targets: new Set([target]) };
  // A model file (entry, helper or constraints) watches its model root; a single-file model's
  // constraints watches that file's directory and filters to the model.
  try {
    if (statSync(target).isDirectory()) return { roots: [target], targets: null };
  } catch {
    return undefined;
  }
  return { roots: [dirname(target)], targets: new Set([target]) };
}
