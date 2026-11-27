# Proposal

## Why

Checking a model change means running `npm run build models/<model>` by hand, then waiting for the
viewer to reload the whole page. The page reload loses the camera and re-fetches and re-converts
every IFC in `out/`, so the context the change was being judged in disappears. The edit-check loop
should be: save a model file, see the rebuilt IFC in the same view.

## What Changes

- **Add `npm run watch [paths…]`.** It watches `models/` for TypeScript changes and rebuilds only
  the affected model or revision through the normal `build` pipeline (checks, building JSON, IFC,
  geometry round-trip and IfcOpenShell validation). Changes are debounced and builds run one at a
  time. A build that fails to load or check the model writes nothing and keeps the previous outputs;
  a build that fails IFC verification has already written its IFC, and the watcher reports the error
  and keeps watching. A failed build never stops the watcher. With no path it watches every model;
  each path must resolve to a model or revision, or the command exits with the usage. Targets follow
  the model layout: a folder model's files, a single-file model, or a revision under `revisions/`; a
  shared helper folder under `revisions/` is left to its revisions. It writes no plans or 3D
  snapshots: that stays `render`/`all`.
- **Reload the rebuilt model in place.** Instead of `full-reload`, the viewer's dev plugin sends a
  custom HMR event naming the rebuilt IFC. When that model is on screen the viewer holds the old
  picture, re-reads its building and constraints JSON, re-fetches just it, re-applies storeys,
  labels, constraints, diff and the rest, then swaps it in, keeping the camera, projection and
  framing. The revision-switch path already has this behaviour. A rebuild counts as a model change,
  so measurements are cleared and walk mode ends. A rebuilt model is released from the revision
  cache even when it is not on screen, and a rebuilt base model's JSON is always dropped.
- **Refresh what depends on the rebuilt file.** Rebuilding a base model drops its cached building
  JSON even with Diff off, so a later Diff is computed against the new base; when a revision is
  shown in Diff mode the ghost model is dropped and the diff is redrawn at once. An event for a
  model that is not on screen leaves the scene alone and refreshes the model and revision pickers,
  so a newly built revision appears without a page reload.
- **No new dependency.** The watcher uses recursive `fs.watch` and the existing pinned `tsx`.
- **BREAKING** (developer workflow only): a rebuilt IFC no longer reloads the page. The dev-only
  custom event has no effect on `npm run viewer:build` or `npm run viewer:preview`.

Out of scope: watching `src/` or the schema; rebuilding a base model's revisions automatically when
the base changes; removing outputs when a model source is deleted; rendering plans and 3D snapshots
on change; starting the viewer from the watch command; moving IFC verification before `build` writes
its files, so a verification-failed build still leaves its IFC in `out/` (reported, not removed).

## Capabilities

### New Capabilities

- `dev-loop`: the local watch command that rebuilds a model's outputs when its source files change.

### Modified Capabilities

- `ifc-viewer`: a rebuilt IFC reloads only that model in place rather than reloading the page, its
  JSON is re-read, the revision cache is invalidated for the rebuilt IFC, unshown rebuilds refresh
  the pickers, and Diff compares against the rebuilt base.

## Impact

- `package.json`: add the `watch` script.
- New `scripts/watch.ts` (and a testable path-to-target helper), using `fs.watch` and `tsx`.
- `src/frontend/vite/plugin.ts`: send `elmstead:ifc` with the rebuilt model name instead of
  `full-reload`; add its custom-event type declaration.
- `src/frontend/scene/engine.ts` and `App.tsx`: register the dev-only listener, add
  `reloadModel(name)` with resident, base-JSON and ghost invalidation, serialised with the existing
  load epoch; update the store's model and revision lists.
- Tests: target-mapping and build-queue unit tests; a Playwright viewer test using the Diff-mode
  harness that proves the camera survives a rebuilt IFC, the page did not navigate, and the
  pickers, Diff and ghosts refresh; existing viewer suites stay green. Add the browser test to a CI
  viewer group, the `rest` excludes and `test:fast`'s excludes.
- Docs: `docs/development.md` and `AGENTS.md` list the watch command and the two-terminal loop;
  `docs/development.md`'s tests table and `docs/getting-started.md` understand the loop;
  `docs/rendering.md` describes the in-place reload instead of the page reload.
- No schema, model, IFC, JSON, SVG or PNG output changes.
