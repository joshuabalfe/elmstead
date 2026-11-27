# Design

## Context

See `proposal.md` - Why. The current app is Vite 8.3.8, ThatOpen components 3.6.0 and three 0.187.0.
`viewer/main.ts` (1,989 lines) creates the scene, loads IFC and JSON, owns all controls, reads and
writes the URL, and paints the measurement list, changes panel and status line by hand.
`viewer/index.html` holds the toolbar and its styles inline. The Vite plugin in
`viewer/vite.config.ts` serves `/models.json`, `/out/*` and the web-ifc WASM, confines those routes
and reloads the page when an IFC changes. There is no production build.

Two test surfaces depend on the DOM staying put: the Playwright view tests use ids such as
`#model`, `#storeys`, `#measure-list` and `[data-view]`, and the snapshot/plan-versus-3D drivers
wait on `window.__elmsteadReady` and read the WebGL canvas from `#container canvas`. The viewer is
also the only browser consumer of the pipeline: it imports types and drawing primitives from
`schema`, `geometry`, `render`, `diff`, `constraints` and `ifc`.

`src/` currently groups code by domain but not by runtime. Browser and Node modules sit side by
side, and moving the viewer inside would make that ambiguity worse. The delta spec in this change
adds only the production build and preview behaviour; the rest of the migration is an
implementation refactor.

## Goals / Non-Goals

**Goals:**

- A React UI with explicit state ownership and component boundaries, while the 3D engine remains
  imperative and never re-renders through React.
- Three physical boundaries with one dependency direction: `frontend -> shared`,
  `backend -> shared`, and `shared` depending on neither.
- A production build and preview server that behave like the dev server for models, WASM and
  confinement.
- Preserve URLs, controls, snapshots, test hooks and the selectors the browser tests use.
- Land in small, always-runnable commits: the move is mechanical first, the React rewrite second.

**Non-Goals:**

- Redesigning the viewer or adding features; every URL parameter and control keeps its behaviour.
- A hosted deployment or API server. "Backend" here means the Node pipeline, not a service.
- Replacing ThatOpen, three.js or the IFC loader.
- A component-test framework (jsdom, React Testing Library); the Playwright suites stay the UI
  contract.
- Server-side rendering, a router, a CSS framework or a state-management library.
- Moving `models/` or changing the schema, IFC, plan drawings or generated outputs.

## Decisions

### React 19 with the Vite React plugin

Use React 19.3.1 and react-dom 19.3.1, with `@vitejs/plugin-react` 6.3.0 and the matching
`@types/react` 19.3.3 and `@types/react-dom` 19.3.0, all pinned exactly. The plugin's Vite 8 peer
range matches the installed Vite; its `oxc-transform-react`, Rolldown Babel and React Compiler
peers are optional and stay absent unless the build proves it needs one.

React and react-dom go in `devDependencies`, like three and the ThatOpen packages: they are build
inputs for the private viewer, while `dependencies` stays the Node-run pipeline runtime
(`zod`, `web-ifc`, resvg). There is no router because the current query-string state is already a
complete model, no CSS framework because the UI is small and the existing styles are plain CSS, and
no state library because one external store is enough.

Alternatives considered: Preact (smaller, but not what was asked for and a smaller ecosystem);
Svelte or Solid (a full rewrite of the UI model without removing the three.js boundary problem);
web components (leaves state sharing implicit, which is the problem being solved).

### React owns the DOM; one engine owns the scene

`main.tsx` creates a `ViewerEngine` once and renders `<App engine={engine} />`. `Viewport` renders
`<div id="container" ref>` and hands the element to the engine; the engine is the only code that
creates three.js objects, fragments, cameras and overlays, and it never queries document-wide
elements. React components never touch three.js directly.

The engine exposes:

- commands: `showModel`, `chooseRevision`, `chooseStorey`, `setView`, `setCamera`, `setLabels`,
  `setConstraints`, `setIds`, `setMeasuring`, `clearMeasurements`, `enterWalk`, `exitWalk`,
  `setDiff`, `setXray`, `setChangeCategory`, `flyToChange`;
- a `getSnapshot()` / `subscribe()` pair for a small external store, read by React with
  `useSyncExternalStore`;
- the existing load epoch and resident-model cache, moved without behaviour changes, so revision
  switching keeps the previous picture while the next loads.

The store holds only discrete UI state: status text, models, model/revision, storeys and shown
storeys, view and style, the mode toggles, measurements, the diff summary and its hidden
categories, walk/measure prompts, and ready/error. Camera movement and frame-loop work do not
notify React, so the toolbar cannot cause per-frame renders. The engine remains the source of
truth; the store is a projection it updates after state changes.

Keyboard shortcuts (storey stepping, revision stepping) move to a `useViewerShortcuts` hook that
calls engine commands and keeps the existing focus, modifier, auto-repeat and walk-mode rules.
WASD and arrow-key movement stay inside the engine's walk loop.

Alternatives considered: `react-three-fiber` would replace how the scene is composed and duplicated
what ThatOpen already manages while adding a large dependency; keeping DOM mutation in the engine
and wrapping React around it would leave two owners of the same UI.

React StrictMode is not enabled for this app. The engine owns a single WebGL context, and React 19
runs development effects twice; attaching and detaching the renderer twice at startup costs a
context and a full scene rebuild for no benefit. The React/engine boundary is exercised by the
browser suites instead.

### Keep ThatOpen; no React Three wrappers

The scene runtime stays on `@thatopen/components` and `@thatopen/fragments`. The value is
concentrated in three places: `IfcLoader` turns IFC into fragments; `FragmentsModel` gives
per-item metadata, visibility and materials plus `getItemsGeometry`; and `raycastWithSnapping`
provides the measured corner and edge snaps. The component container, world, scene, renderer and
grid wrappers are thin convenience, and `OrthoPerspectiveCamera` is useful but is the source of
the walk-mode, framing-restoration and near/FOV workarounds, so it stays behind the engine
boundary.

Do not add `react-three-fiber` or `drei`. They assume React owns the scene graph, while ThatOpen
owns the renderer, camera and fragments update loop; bridging them would add a second rendering
paradigm and reconcile overlay meshes the engine currently batches. If ThatOpen becomes a blocker,
the first exit step is to own the renderer and camera in raw three.js while keeping `IfcLoader` and
`FragmentsManager`; replacing fragments is a separate, larger change.

### Component and module layout

```
src/frontend/
  index.html            root element and module script only; no inline controls or styles
  main.tsx              reads the URL, creates the engine and store, mounts <App>
  App.tsx               composes the viewport and UI; snapshot mode renders only the viewport
  components/           Toolbar, ModelPicker, RevisionPicker, StoreyPicker, ViewControls,
                        ToggleButton, Status, Compass, WalkHint, MeasureHint,
                        MeasurementList, ChangesPanel
  scene/                engine.ts and the three.js-facing helpers: overlay, text, identify,
                        dispose, style-of, constraint billboards, diff presentation
  state/                store.ts (external store) and url.ts (parse and patch query state)
  lib/                  browser-safe, three-free helpers used by the engine and unit tests:
                        measure, walk, view, revisions, diff
  vite/                 Node-only build tooling: the Vite plugin and confinedPath
  styles.css            the styles currently inline in index.html
  vite.config.ts
  tsconfig.json
```

The existing files map over without logic changes where possible:

| Current                                                                                      | New                                                           |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `viewer/main.ts`                                                                             | `scene/engine.ts`, `state/store.ts`, `App.tsx` and components |
| `viewer/index.html`                                                                          | `index.html` + `styles.css`                                   |
| `viewer/overlay.ts`, `text.ts`, `identify.ts`, `dispose.ts`, `style-of.ts`, `constraints.ts` | `scene/`                                                      |
| `viewer/measure.ts`, `walk.ts`, `view.ts`, `revisions.ts`, `diff.ts`                         | `lib/`                                                        |
| `viewer/serve.ts`, `vite.config.ts`                                                          | `vite/serve.ts`, `vite/plugin.ts`, `vite.config.ts`           |

### Source boundaries

- `src/shared/`: `schema` (including the JSON Schema export), `geometry`, the plan drawing
  primitives (`plan`, `svg`, `style`, `views`), `diff`, the IFC style table, and the resolved
  constraint contract (the `ResolvedConstraint` type and constraint group schema). Every module
  here is browser-safe: no `node:` imports and no DOM requirement.
- `src/backend/`: `cli`, `checks`, `constraints` (load, resolve, revise, check), `ifc` (writer,
  GUIDs, round-trip, validator bridge), `render` (SVG-to-PNG and the snapshot driver), `model`,
  `io`, `paths` and `root`.
- `src/frontend/`: the React app. Browser code may import `shared` only. The exception is
  `vite/`, which is Node build tooling and may import `backend/root` for `PROJECT_ROOT`.

The rule is enforced by a small vitest check that scans import specifiers: no `node:` or
`backend` import from `shared`, and no `node:` or `backend` import from browser frontend files
(`vite/` excluded). This catches the mistake with a fast failure rather than a browser-only error
at runtime.

The move is mechanical: `git mv` the folders, rewrite relative imports and test/script paths, and
run the full suite before touching React. Keeping it as its own commit makes review a path diff
and keeps the React change readable.

Alternative considered: keeping the flat layout and relying on convention. The viewer already
imports pipeline internals, so convention is exactly what is missing.

### Build and serving

`src/frontend/vite.config.ts` sets `root` to the frontend directory, adds `react()` to the
existing `elmstead()` plugin, and builds to the repository's git-ignored `dist/` with
`emptyOutDir: true`. The plugin's route handler is extracted so `configureServer` and
`configurePreviewServer` share the `/models.json`, `/out/*` and `/wasm/*` routes and the same
`confinedPath` checks; only the dev server adds the watcher and full-page reload. Preview keeps
the same `ELMSTEAD_OUT_DIR` behaviour.

Scripts:

- `npm run view` — Vite dev server, unchanged behaviour, new config path;
- `npm run viewer:build` — `vite build` to `dist/`;
- `npm run viewer:preview` — `vite preview` on the same config;
- `npm run typecheck` — root `tsc` plus `tsc -p src/frontend`.

The model `build` script keeps its name, so the two builds cannot collide. The root
`tsconfig.json` excludes `src/frontend`; `src/frontend/tsconfig.json` sets `jsx: "react-jsx"`,
`module`/`moduleResolution` to `ESNext`/`Bundler`, DOM libraries and `vite/client` types. Tests
that import `lib/` helpers stay under the root Node config, so those helpers must remain free of
DOM and React imports.

The fast CI job runs `npm run viewer:build` after typecheck and the schema check, so a build-only
failure (worker URL, WASM handling, a missing React peer) fails CI even when the dev-server tests
pass. The preview behaviour is covered by a route-handler test and by the full-suite golden path.

### Preserve the test and snapshot surface

React renders the same ids on the controls (`#model`, `#revision`, `#storeys`, `#labels`,
`#constraints`, `#ids`, `#measure`, `#clear`, `#walk`, `#diff`, `#xray`, `#status`, `#compass`,
`#walk-hint`, `#measure-hint`, `#measure-list`, `#changes`), the same `data-view` values on view
buttons and `data-id` on change entries, and the same `#container canvas` inside the viewport. The
browser tests therefore change import paths and, where necessary, selectors that depended on
markup shape, not the tested behaviour.

`window.__elmsteadReady`, `window.__elmsteadError` and `window.__elmsteadStoreyChanges` are set by
the engine exactly as today. In snapshot mode `main.tsx` adds `body.snapshot`, `App` renders only
the viewport and the CSS keeps hiding the toolbar, hints, list and panel. The canvas, renderer,
camera setup and overlays are untouched, so the 3D PNGs and the plan-versus-3D comparison should
be pixel-identical; the full suite verifies that.

### Migration sequence

1. **Move the pipeline.** Create `src/shared` and `src/backend`, move modules and rewrite imports
   across `src`, `models`, `tests` and `scripts`; keep the vanilla viewer in `viewer/`, only
   updating its imports. Full test suite green.
2. **Move the viewer.** `git mv viewer src/frontend`, add the new config and tsconfig, wire the
   scripts and update the snapshot/test/script config paths. Still vanilla, full suite green.
3. **Introduce React around the engine.** Split `main.ts` into the engine, store and a minimal App
   that renders the existing controls; move the DOM wiring in pieces, with the browser tests as the
   guard after each piece.
4. **React the remaining panels.** Measurement list, changes panel, hints, compass and status move
   to components; remove the last `getElementById` calls from the engine.
5. **Build, CI and docs.** Add the production build/preview plumbing, the boundary and route tests,
   the CI build step, and the documentation updates.

Each step is independently runnable and reviewable; steps 3 and 4 can be split further per control
group if a browser suite needs a smaller change.

## Risks / Trade-offs

- **React and the engine fight over lifecycle or state.** → The engine is created outside React,
  owns the canvas, never queries the document, and publishes only discrete state; React reads it
  through one store. No StrictMode double-mount.
- **Snapshot pixels change because the shell moved.** → Snapshot mode renders only the viewport and
  keeps the existing body class and CSS hiding rules; the snapshot, plan-versus-3D and CLI snapshot
  tests run before the change is considered done.
- **The mechanical move creates a large conflict surface with parallel branches.** → Do it first as
  one no-logic commit, after re-checking open pull requests; later commits touch the new paths only.
- **The production build fails where the dev server worked** (worker URL, optional React transform
  peer, WASM paths). → CI builds the viewer on every fast run, and the preview route test exercises
  the shared handler; add a missing optional peer only if the pinned plugin requires it.
- **A frontend module imports Node or backend code by accident.** → The import-boundary test fails
  in `test:fast`; `src/frontend/vite/` is the only Node exception.
- **Duplicate state between the engine and React drifts.** → The engine is the single writer for
  viewer state; components only call commands and render the store snapshot.
- **The measurement list and changes panel rerender too often.** → They read discrete state, not
  camera frames; measurements update only when added, cleared or the model changes.
- **React adds bundle size.** → Roughly 50 kB gzipped for a local tool whose three.js payload is far
  larger; acceptable and not a spec requirement.
- **ThatOpen is a large, pinned dependency whose defaults we partly work around.** → Confine its
  calls to `scene/`, keep the raw-three renderer/camera exit path, and do not spread its types into
  components or shared code.

## Migration Plan

The five steps above are the migration plan. Nothing is persisted and no output files change, so a
rollback is a revert: the old `viewer/` app and the old paths return with the same generated
outputs. `dist/` is disposable and git-ignored. The change is not deployable until step 5; the
preview server is local-only.

## Open Questions

None. Where the built bundle is hosted is outside this change; the preview server and CI build are
enough to prove the output.
