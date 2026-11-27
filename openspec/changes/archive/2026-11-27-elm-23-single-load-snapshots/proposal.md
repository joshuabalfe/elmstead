# Proposal

## Why

`render` takes each 3D snapshot through a full page load: `snapshot3d` does a `page.goto` per
camera, so a base model reloads the viewer five times and a revision ten (plain + Diff). Every load
re-fetches the IFC, re-initialises the web-ifc WASM and re-converts the model to Fragments — the
dominant cost of a render, paid five to ten times over. This is the slowest part of the CLI tests
(`cli-diff-snapshots` writes ten pictures per render) and of every `npm run all`.

## What Changes

- `snapshot3d` opens the viewer **once per snapshot variant** (plain; Diff for a revision) with the
  first camera's `?view=`, waits for `window.__elmsteadReady`, and captures it.
- Each later camera is drawn by switching the view **in the same page** (`chooseView`), waiting for
  a new view-settled test hook, then capturing. A revision's Diff variant loads with `&diff=1` as
  today; the plain and Diff variants remain separate page loads.
- The viewer gains a `window.__elmsteadViews` counter, incremented after a view choice has been
  applied and drawn (the same two-frame pattern as `__elmsteadStoreyChanges`), so the snapshot
  driver can wait for each camera to settle.
- The PNG contract is unchanged: same cameras, same framing, same 1200 × 900 files, same names.
  Acceptance is byte-identical PNGs before and after, plus a measured render-time comparison.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ifc-viewer`: the _Snapshot capture_ requirement changes from one page load and
  `__elmsteadReady` wait per camera to one page load per variant; a new _Snapshot view switching_
  requirement owns the in-page switch and the `__elmsteadViews` settled hook. The _3D snapshots_,
  _Snapshot cameras_ and _Diff snapshots_ requirements are unchanged.

## Impact

- `src/backend/render/snapshot3d.ts` — the capture loop.
- `src/frontend/scene/engine.ts` — `chooseView` announces the settled view; a new test hook.
- `tests/cli-diff-snapshots.test.ts`, `tests/snapshot.test.ts` — the CLI test asserts the measured
  page-load count per variant, and a new viewer test proves an in-page switch matches a fresh load.
- `docs/rendering.md` — how snapshots are produced.
- No new dependencies. Residual coupling: ELM-25 (engine decomposition) will move `chooseView`;
  whichever lands second re-cuts the hook's placement. ELM-22's watch/reload path is untouched —
  snapshots neither watch nor reload.
