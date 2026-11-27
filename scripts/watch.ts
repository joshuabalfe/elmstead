import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, watch, type FSWatcher } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PROJECT_ROOT } from "../src/backend/root.js";
import { createBuildQueue } from "./watch-queue.js";
import { scopeFor, targetFor, type WatchScope } from "./watch-targets.js";

const MODELS = join(PROJECT_ROOT, "models");
const CLI = join(PROJECT_ROOT, "src/backend/cli/index.ts");
const USAGE = "usage: npm run watch [models/<model> ...]";
const DEBOUNCE_MS = 150;

/** A short path for the log. */
const shown = (path: string) => relative(PROJECT_ROOT, path) || path;

function main(): void {
  const args = process.argv.slice(2);
  const scopes: WatchScope[] = [];
  let bad = false;
  if (args.length === 0) {
    scopes.push({ roots: [MODELS], targets: null });
  } else {
    for (const arg of args) {
      const scope = scopeFor(MODELS, resolve(arg));
      if (scope) scopes.push(scope);
      else {
        console.error(`watch   ${arg} is not a model or revision under models/`);
        bad = true;
      }
    }
  }
  if (bad) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  const workers = new Set<FSWatcher>();
  let child: ChildProcess | null = null;
  let stopped = false;
  let warnedNullName = false;
  const ignored = new Set<string>();

  // One watcher per directory: overlapping path arguments merge into one allowed-target set.
  const plans = new Map<string, Set<string> | null>();
  for (const scope of scopes) {
    for (const root of scope.roots) {
      const current = plans.get(root);
      if (current === undefined) plans.set(root, scope.targets);
      else if (current === null) continue;
      else if (scope.targets === null) plans.set(root, null);
      else for (const target of scope.targets) current.add(target);
    }
  }

  const allowed = (root: string, target: string): boolean => {
    const targets = plans.get(root);
    return targets === null || targets?.has(target) === true;
  };

  const build = (target: string): Promise<void> =>
    new Promise((resolveBuild) => {
      console.log(`watch   building ${shown(target)}`);
      const started = spawn(process.execPath, ["--import", "tsx", CLI, "build", target], {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
      });
      child = started;
      started.on("error", (error) => {
        console.error(`watch   could not start the build: ${String(error)}`);
        if (child === started) child = null;
        resolveBuild();
      });
      started.on("exit", (code) => {
        if (!stopped) console.log(`watch   ${code === 0 ? "built" : "failed; still watching"} ${shown(target)}`);
        if (child === started) child = null;
        resolveBuild();
      });
    });

  const queue = createBuildQueue({ debounceMs: DEBOUNCE_MS, run: build });

  const stop = (code = 0): void => {
    if (stopped) {
      process.exitCode = code;
      return;
    }
    stopped = true;
    queue.stop();
    for (const watcher of workers) watcher.close();
    workers.clear();
    child?.kill();
    child = null;
    process.exit(code);
  };

  const onEvent = (root: string, filename: string | Buffer | null): void => {
    if (!filename) {
      if (!warnedNullName) {
        console.error("watch   ignoring an event without a file name");
        warnedNullName = true;
      }
      return;
    }
    const file = resolve(root, filename.toString());
    // A deleted source rebuilds nothing and removes no output.
    if (!existsSync(file)) return;
    const target = targetFor(MODELS, file);
    if (target) {
      if (allowed(root, target)) queue.add(target);
    } else if (file.endsWith(".ts") && !ignored.has(file)) {
      ignored.add(file);
      console.log(`watch   ${shown(file)} is not a model or revision; no build`);
    }
  };

  const start = (root: string): void => {
    let watcher: FSWatcher;
    try {
      watcher = watch(root, { recursive: true }, (_event, filename) => onEvent(root, filename));
    } catch (error) {
      console.error(`watch   cannot watch ${shown(root)}: ${String(error)}`);
      stop(1);
      return;
    }
    watcher.on("error", (error) => {
      console.error(`watch   watcher error: ${String(error)}; re-arming`);
      watcher.close();
      workers.delete(watcher);
      if (!stopped) setTimeout(() => start(root), 1_000);
    });
    workers.add(watcher);
  };

  for (const root of plans.keys()) start(root);
  if (stopped) return;
  console.log(`watch   watching ${[...plans.keys()].map(shown).join(", ")}`);

  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
}

main();
