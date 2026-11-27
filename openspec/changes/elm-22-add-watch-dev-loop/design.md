# Design

## Context

See `proposal.md` - Why. On `main` (after ELM-21) the viewer is under `src/frontend/`: the engine in
`src/frontend/scene/engine.ts` owns the scene, the resident-model cache, the load epoch, `viewChain`
and the held-frame pattern used by revision switches; `App.tsx` creates it. The Vite plugin
`src/frontend/vite/plugin.ts` serves `/models.json`, `/out/*` and the WASM, and currently sends
`{ type: "full-reload" }` when an IFC is added or changed.

Models are TypeScript modules: a folder with `index.ts`, a single `.ts` file, or a revision under
`<model>/revisions/<revision>.ts` or `<model>/revisions/<revision>/index.ts`. Helper folders under
`revisions/` without an `index.ts` are shared by revisions and are not models
(`src/backend/paths.ts`).

`build` runs the checks, writes the building JSON and IFC, then verifies the IFC with web-ifc and
IfcOpenShell. A load or check failure writes nothing; a verification failure exits non-zero but
leaves the written IFC in `out/`. On the example two-storey model a build takes about 6 s; the model
import and checks are about 3 s of that. The change does not move verification before the writes.

Vite 8.3.8 types a custom dev event as `server.hot.send(event, payload)` on the server (the
`server.ws` alias accepts the same) and `import.meta.hot.on(event, cb)` in the browser;
`import.meta.hot` is absent from a production build.

## Goals / Non-Goals

**Goals:**

- A watched save rebuilds only its model or revision, with the same checks as `npm run build`.
- The viewer updates in place: same page, camera, projection, storeys and toggles.
- Failures are reported accurately: a pre-write failure never removes the last good IFC; a
  verification failure is reported without stopping the watcher.
- No new dependency, no schema or generated-output change.

**Non-Goals:**

- A combined command that also starts Vite. `npm run watch` is run beside `npm run view`; combining
  the two adds process lifecycle and startup-order handling without changing the loop.
- Moving IFC verification before `build` writes, so a verification-failed build leaves its IFC.
- Watching `src/` or `schema/`, cascading a base-model build to its revisions, reacting to deleted
  sources, or building at watcher startup when no file changed.
- Rendering plans or 3D snapshots on change; those stay explicit `render`/`all` commands.
- Hot reload in `viewer:preview`: it has no dev channel and keeps its static behaviour.

## Decisions

### A separate watcher script, not `tsx watch`

Add `scripts/watch.ts`, run by `npm run watch [paths…]`. It owns one recursive `fs.watch` on
`models/` and maps each event to a build target. `tsx watch` was considered and rejected: it
watches one entry point's import graph, restarts that process on every change, has no notion of
"model versus revision" across the tree, and would need one watcher per model. Recursive
`fs.watch` is supported on the repo's Node >= 22 floor on macOS, Windows and Linux.

The mapping lives in a pure module, `scripts/watch-targets.ts`, so it can be tested without a live
watcher. The script handles `change` and `rename` events (an atomic save replaces the file), ignores
events with a null filename after logging once, and on `error` logs, re-creates the watch and keeps
running; if re-creating fails it exits non-zero. On SIGINT/SIGTERM it closes the watcher and kills a
running child.

Builds run as a child process:
`node --import tsx src/backend/cli/index.ts build <target>`. This reuses the pinned `tsx` and the
existing CLI without refactoring the CLI into a library, and works on every platform. The watcher
prints when a build starts and whether it passed; the CLI's own issue lines follow.

`npm run watch` takes no paths or one or more model/revision paths. Each path is resolved through
the target rules at startup; a path that maps to nothing prints the usage and exits 2. Watching a
model watches its root; watching a file revision watches the `revisions/` folder and filters events
to that revision, and a single-file model is watched through its directory, because an atomic save
replaces the file's inode.

### Mapping a changed path to a target

At resolution time, the model root for a changed file is the highest ancestor under `models/` that
contains `index.ts`. This is what keeps `models/elmstead/ground/` (a storey folder with its own
`index.ts`) from being mistaken for a model: `elmstead` is the higher root. It also handles a newly
added model folder without a watcher restart. For a changed TypeScript file:

1. If it is inside a model root's `revisions/` folder:
   - a file `<revision>.ts` or `<revision>.constraints.ts` targets `<model>/revisions/<revision>.ts`
     when that file exists;
   - a folder `<revision>/` with `index.ts` targets the folder;
   - any other folder under `revisions/` is a shared helper and is ignored, with one log line: a
     base build does not import it, and rebuilding every revision on every helper save is the
     cascade this change excludes.
2. Otherwise the target is the model root that contains the file (helper, entry point or
   constraints).
3. A TypeScript file directly under `models/` or `models/examples/`, outside any model root, is a
   single-file model and is its own target; its `<name>.constraints.ts` maps to `<name>.ts`.
4. Anything else, any non-TypeScript file, and any path outside `models/` is ignored.

A change to a base model does not rebuild its revisions. A revision imports its base, so a base edit
can leave a revision's own IFC stale and the diff will attribute base changes to the revision; the
revision is rebuilt by saving it. This is a deliberate limitation.

### Debounce and one build at a time

Events feed a pending set of targets; a 150 ms timer collapses the several events one editor save
produces into one build. A single worker drains the queue: while a build runs, new targets wait,
and one follow-up build per target runs afterwards. Nothing runs concurrently, so two `tsx`
processes never race on `out/`. A non-zero exit is logged and the queue continues.

### A typed custom dev event instead of a full reload

The plugin watches the output directory itself — Vite's chokidar disables globbing, so the old
`*.ifc` glob silently watched nothing — and replaces `full-reload` with a typed `elmstead:ifc`
custom event via `server.hot.send(event, payload)`, where `name` is the IFC's basename without
`.ifc` — exactly the model or `<model>@<revision>` output name. A `CustomEventMap` augmentation in
the frontend types both ends. The event is dev-only: the production/preview route handler is
unchanged, and `import.meta.hot` is undefined in the built bundle.

The plugin decides membership with a path relative to the output directory, not `startsWith`, so a
sibling such as `out-old/` cannot match. `/models.json` gains `cache-control: no-store` so the
picker refresh after a rebuild is never served from a cache.

Alternatives considered: polling `/models.json` plus an mtime endpoint (extra requests and latency
for no benefit); a bespoke WebSocket or EventSource (duplicates the channel Vite already runs);
`import.meta.hot.accept` (there is no module change to accept — the data changed).

### Reload in place through the engine's existing load path

Add `reloadModel(name)` to `ViewerApi`; `App.tsx` registers
`import.meta.hot?.on("elmstead:ifc", ...)` after `start()` and removes it on unmount. The optional
chain keeps `viewer:preview` safe. Reloads append to the existing `viewChain`, so a Diff,
Transparency or panel change and a reload cannot interleave their dressing, and the existing
`loadEpoch` still supersedes an overtaken load. After its turn in the chain, the task re-reads
`currentName`: if the user has switched models while it waited, the reload does nothing.

The handler:

1. Re-read `/models.json`, regroup the model and revision lists and update the store, keeping the
   current selection. This makes a newly built revision appear, and is a no-op for an unchanged set.
2. Drop the cached base building JSON for `name` unconditionally — `refreshDiff` refetches only a
   missing key (`baseJson`), and a base rebuilt with Diff off must not leave a stale diff for a
   later toggle.
3. If `name` is the shown model or revision: leave walk mode, hold the frame (disable the renderer
   so the old drawing buffer stays), release the named resident, then `show(name, { keepView: true })`.
   `show` re-reads the building and constraints JSON, so labels, dimensions, constraints and the
   changes panel refresh. Releasing after the hold, not before, is what makes the no-flicker
   guarantee hold.
4. If the shown model is a revision in Diff mode and the rebuilt name is its base: hold the frame,
   clear the ghost state (`ghostModel`, `ghostItems`, `ghostLabels`, its object), release the base
   resident, and re-run `show(shown, { keepView: true })`, which recomputes the diff and redraws the
   ghosts from the new IFC.
5. Otherwise release the named resident so a stale converted copy can never be shown later; the
   scene is untouched and the picker refresh from step 1 is the only effect.
6. On a reload failure, report the error through the store and status, re-enable the renderer and
   keep the session alive. The previous model cannot be restored (its IFC has been replaced), so
   the canvas may be empty until the next successful rebuild; the alternative, fetching before
   release and swapping only on success, needs a non-destructive load path and is left out.

The success path increments `window.__elmsteadReloads` after two animation frames, like the
revision counter, so the browser test has a completion signal. A failure does not increment it.
`show`/`load` already re-apply the URL's storeys, Ids, labels, constraints and Diff state, clear
measurements and keep the camera when `keepView` is set, so the in-place path inherits those
behaviours rather than duplicating them. Update the resident-cache comment that still says a
rebuild reloads the page.

### Tests

- `tests/watch-targets.test.ts` unit-tests the pure mapping: outermost model root (including the
  `ground/` nested `index.ts` trap), entry point, constraints, file revision and its constraints,
  folder revision helper, shared helper folder (ignored), single-file model, outside `models/`,
  non-TypeScript.
- `tests/watch-queue.test.ts` uses fake timers and an injected runner: one save causes one build,
  a save during a build causes one follow-up, never overlapping, and a failed runner does not stop
  the queue.
- `tests/viewer-hot-reload.test.ts` uses the Diff-mode harness for the whole file
  (`tests/support/diff-mode-page.ts`), because one test file cannot host both `useViewer()` and the
  Diff harness. It publishes IFCs with a temp file plus rename, exercising the atomic-add path. It
  opens a model, moves the camera away from the URL pose (a view button), republishes the identical
  IFC, waits for `__elmsteadReloads` and asserts the before/after pixels are equal: that is what
  proves the camera was not reset by `?camera=`. It also sets a page sentinel to prove there was no
  navigation, republishes a changed IFC, checks that sidecar JSON changes refresh labels and
  constraints, checks that another model's rebuild leaves the shown scene alone, that a new revision
  appears in the picker, that walk mode ends, that a rebuilt base refreshes the diff and ghosts
  (including after turning Diff on when it was off during the rebuild), and that an unreadable IFC
  reports an error and a later valid publish recovers.
- The spawned process itself is not automated; the mapping and queue tests carry the contract, and
  the live watcher is exercised in the manual smoke test on macOS.

## Risks / Trade-offs

- [Recursive `fs.watch` semantics differ per platform] → the mapping and queue unit tests cover the
  contract; CI runs those, and the live watcher is smoke-tested manually. The debounce absorbs
  duplicate and split events.
- [A ~6 s build per save] → debounce and a single queue prevent piled-up builds; `npm run check`
  remains the faster manual loop.
- [Verification failures still write the IFC, and the viewer may show it] → this is existing CLI
  behaviour; the watcher reports the issues, and the proposal rules out moving verification before
  the writes.
- [A reload failure can leave an empty canvas] → defined in the spec as an error with a recovering
  next build; a load-first/swap-last refactor is the stronger alternative and is out of scope.
- [Rebuilding the base while a revision is shown can leave the revision's own IFC stale] → the diff
  and ghosts refresh from the new base; the revision is rebuilt when its source is saved.
- [A reload during a model or revision switch] → `viewChain` plus `loadEpoch`; the task re-checks
  `currentName` after its turn and the overtaken load exits without touching the scene.
- [Custom event API could change between Vite majors] → typed by the pinned Vite version and covered
  by typecheck plus the Playwright test.
