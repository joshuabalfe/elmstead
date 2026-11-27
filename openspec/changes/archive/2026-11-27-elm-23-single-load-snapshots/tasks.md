# Tasks

## 1. Before state

- [x] 1.1 Build and render `models/examples/example-cottage`, its `rear-extension` revision and `models/elmstead` on the unmodified branch; record the PNG sha256 hashes and the render wall-clock times.

## 2. Viewer hook

- [x] 2.1 In `src/frontend/scene/engine.ts`, declare `window.__elmsteadViews` and increment it after `chooseView`'s `setView` resolves and two frames have drawn; in snapshot mode expose `window.__elmsteadChooseView`.
- [x] 2.2 Add a Chromium test (in `tests/snapshot.test.ts`, which owns snapshot behaviour): an in-page `chooseView` increments `__elmsteadViews` and its canvas pixels match a fresh page load with the same `?view=`.

## 3. Snapshot driver

- [x] 3.1 Rewrite the `snapshot3d` loop: one `page.goto` per variant with the first camera's `?view=`, capture on `__elmsteadReady`, then `__elmsteadChooseView` + wait on `__elmsteadViews` for each later camera; keep the error collection and the browser/server cleanup.
- [x] 3.2 Print `snap    <name>: <n> views, <m> page load(s)` per variant, counting the page's own requests for the model's IFC; assert the line and the unchanged PNG set in `tests/cli-diff-snapshots.test.ts`.

## 4. Acceptance

- [x] 4.1 Re-render the three models; compare every PNG's sha256 with the before state — all byte-identical.
- [x] 4.2 Report the before/after render wall-clock times for the base and the revision.

## 5. Docs and verification

- [x] 5.1 Update `docs/rendering.md` (how snapshots are produced) and the `snapshot3d` doc comment.
- [x] 5.2 `npm test`, `npm run typecheck`, `npm run format` and `npx openspec validate --all --strict` pass.
