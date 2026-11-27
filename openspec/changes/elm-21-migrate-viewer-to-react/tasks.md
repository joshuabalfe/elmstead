# Tasks

## 1. Source boundaries

- [x] 1.1 Create `src/shared/` and move the browser-safe modules into it: `schema/`, `geometry/`, `render/{plan,svg,style,views}.ts`, `diff/`, `ifc/styles.ts`, plus the constraint group schema and the `ResolvedConstraint` contract. Rewrite every import in `src/`, `models/`, `tests/`, `scripts/` and the vanilla `viewer/`; verify `npm run typecheck` and `npm test` pass.
- [x] 1.2 Create `src/backend/` and move the Node-only modules into it: `cli/`, `checks/`, the constraint loader/resolver/checker, `ifc/` (writer, GUIDs, round-trip, validator), `render/` drivers (`index`, `png`, `snapshot3d`), `model/`, `io.ts`, `paths.ts` and `root.ts`. Update all imports, including the snapshot driver's config path placeholder; verify `npm run typecheck` and `npm test` pass.
- [x] 1.3 Add `tests/frontend-boundaries.test.ts`, which scans import specifiers and fails when `src/shared/` imports `node:*`, `backend`, or `frontend`, and when browser frontend files (excluding `src/frontend/vite/`) import `node:*` or `backend`; verify `npx vitest run tests/frontend-boundaries.test.ts` passes and that a deliberate temporary violation fails it before reverting the violation.
- [x] 1.4 Update `docs/architecture.md`'s source layout and module-dependency diagram for `frontend`/`backend`/`shared`, and update any `src/` paths it names; verify every listed path exists with `find src -maxdepth 2 -type d | sort`.

## 2. Move the viewer into `src/frontend`

- [x] 2.1 `git mv viewer src/frontend`, then move the pure helpers (`measure`, `walk`, `view`, `revisions`, `diff`) to `src/frontend/lib/`, the three.js helpers (`overlay`, `text`, `identify`, `dispose`, `style-of`, `constraints`) to `src/frontend/scene/`, and `serve.ts`/`vite.config.ts` to `src/frontend/vite/`; update app, test and script imports; verify `npm run typecheck` passes.
- [x] 2.2 Replace `viewer/tsconfig.json` with `src/frontend/tsconfig.json` (JSX, DOM libraries, Bundler resolution, `vite/client`), exclude `src/frontend` from the root tsconfig, and change the `typecheck` script to `tsc --noEmit && tsc --noEmit -p src/frontend`; verify `npm run typecheck` passes.
- [x] 2.3 Point `src/backend/render/snapshot3d.ts`, `tests/support/*.ts`, `tests/viewer-*.test.ts`, `scripts/bench-viewer.ts`, `scripts/compare-viewer.ts` and the `view` script at `src/frontend/vite.config.ts`, keeping the vanilla app; verify `npm test` passes and the 3D snapshots are unchanged.
- [x] 2.4 Update `docs/rendering.md` and `docs/development.md` for the new `src/frontend/` paths and test locations; verify the documented paths exist and the documented `npm run view` command starts the app.

## 3. Production build and preview

- [x] 3.1 Extract the dev plugin's route handling into `src/frontend/vite/plugin.ts` so `configureServer` and `configurePreviewServer` share `/models.json`, `/out/*`, `/wasm/*`, `ELMSTEAD_OUT_DIR` and `confinedPath`; verify a fast unit test covers the routes and a traversal request in both modes.
- [x] 3.2 Add `viewer:build` (`vite build`, output to `dist/`, `emptyOutDir: true`) and `viewer:preview` (`vite preview` on the same config), and add `dist/` to `.gitignore`; verify `npm run viewer:build` succeeds, and `npm run viewer:preview` loads a built IFC with all controls working.
- [x] 3.3 Add `npm run viewer:build` to the fast CI job, update `docs/development.md`'s CI section, and verify `npm run build models/examples/example-cottage && npm run viewer:build` leaves `dist/` populated and `git status` clean of build output.

## 4. React engine and UI

- [x] 4.1 Extract the scene, loading, camera and mode logic from `main.ts` into `src/frontend/scene/engine.ts` with the command and subscribe API in the design, plus `src/frontend/state/store.ts`; keep a thin imperative adapter so the current controls still work; verify `npm run typecheck` and the viewer browser suites pass.
- [x] 4.2 Add the pinned React, react-dom, type and `@vitejs/plugin-react` dependencies, change `index.html` to a root element, and add `main.tsx`/`App.tsx` with the toolbar, model/revision/storey pickers and view/toggle buttons reading the store and calling engine commands; verify `npm run typecheck`, the viewer browser suites and `npm run viewer:build` pass.
- [x] 4.3 Move the measurement list, walk and measure hints, changes panel, compass and status line into React components, preserving `#container canvas`, the existing ids, `data-view`/`data-id`, the body classes and the `window.__elmstead*` hooks; verify `tests/viewer-measure.test.ts`, `tests/viewer-identify.test.ts`, `tests/viewer-diff-mode.test.ts`, `tests/viewer-diff-ghosts.test.ts` and `tests/viewer-presentation.test.ts` pass.
- [x] 4.4 Move the storey and revision keyboard shortcuts into `useViewerShortcuts`, keeping the focus, modifier, auto-repeat and walk-mode rules; verify `tests/viewer-storey-keys.test.ts` and `tests/viewer-revisions.test.ts` pass.
- [x] 4.5 Update `docs/rendering.md` with the React/engine split, the component and scene responsibilities, and the build/preview commands; verify the described controls by running `npm run view` and `npm run viewer:preview`.
- [x] 4.6 Remove the last `getElementById` calls from the engine and confirm the boundary: verify `grep -rn "getElementById" src/frontend/scene src/frontend/lib` returns no matches, then run `npm run typecheck`.

## 5. Integration verification

- [x] 5.1 Run `npm test`, `npm run typecheck` and `npm run format:check`; confirm the plan SVG snapshot, 3D snapshots and plan-versus-3D comparisons are unchanged and `git status` shows no generated schema, IFC, SVG or PNG changes.
- [x] 5.2 Walk the golden path in `npm run view` and in `npm run viewer:preview`: model and revision switching, storey selector and arrow keys, every view and toggle, measure and clear, walk in and out, ids hover, diff and changes panel, and `?snapshot=1`; verify behaviour matches the current app.
- [x] 5.3 Run `npm run viewer:build` a second time and confirm the previous `dist/` is replaced with no stale assets.

## Workflow follow-up

- Review the implementation against the delta spec and get feedback before merging.
- Archive the change after review and merge.
