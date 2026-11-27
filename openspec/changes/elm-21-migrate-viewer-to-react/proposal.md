# Proposal

## Why

The viewer has outgrown its raw HTML-and-JavaScript shape. `viewer/main.ts` is a 1,989-line file
that owns the 3D engine, every control, URL state and the DOM: labels, constraints, measure, ids,
storeys, revisions, diff, transparency and the changes panel all mutate elements by id and share
implicit state. Each new viewer feature makes that harder to change safely, there is no production
build, and the browser app sits outside `src/` while importing browser-safe pipeline modules from
inside it.

## What Changes

- **Move the viewer under `src/` and render its UI with React.** `viewer/` becomes
  `src/frontend/`; React 19.3.1 renders the toolbar, pickers, hints, measurement list, changes
  panel, compass and status. The 3D viewport stays on three.js and ThatOpen: React owns the DOM and
  UI state, an imperative engine owns the scene.
- **Split `main.ts` along that boundary.** The engine (ThatOpen components, camera, fragments,
  picking, labels, overlays, walk/measure/diff presentation) moves behind an explicit
  command-and-event API under `src/frontend/scene/`. React components call that API and subscribe
  to one small external store, without a state-management library. The existing pure helpers and
  their unit tests move with the app.
- **Reorganise `src/` into three boundaries:**
  - `src/frontend/` — browser-only viewer code;
  - `src/backend/` — Node-only pipeline code (CLI, checks, constraints, IFC writer and validator,
    plan and PNG rendering, the 3D snapshot driver, model helpers and IO);
  - `src/shared/` — browser-safe code both sides use (schema and types, geometry, plan drawing
    primitives, styles and views, diff computation, IFC style table, the resolved-constraint type).

  **BREAKING** (internal only): imports, test paths, scripts and the Vite config move; no published
  API or user-facing URL changes.

- **Add proper build steps.** `npm run view` remains the dev server; `npm run viewer:build` writes a
  static bundle under the git-ignored `dist/`, and `npm run viewer:preview` serves that bundle with
  the same `/models.json`, `/out/*` and `/wasm/*` routes, still with nothing from a CDN. CI builds
  the viewer alongside typechecking it.
- **Preserve observable behaviour.** Existing URL parameters, controls, snapshot output and test
  hooks (`window.__elmsteadReady`, `window.__elmsteadError`, `window.__elmsteadStoreyChanges`) stay
  as they are. The DOM ids and `data-view`/`data-id` attributes the browser tests use remain part
  of the UI. 3D snapshots and plans must not change pixel for pixel.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ifc-viewer`: add a requirement for building and previewing a production viewer bundle. The React
  and folder-boundary changes are implementation refactors and do not change specified behaviour.

## Impact

- `viewer/` is removed; its code moves to `src/frontend/{components,scene,state,lib,vite}/`.
- Pipeline modules move from `src/<area>/` to `src/backend/<area>/` or `src/shared/<area>/`.
- `package.json`: the `view` and `typecheck` scripts change; add `viewer:build` and
  `viewer:preview`; pin `react`, `react-dom`, `@types/react`, `@types/react-dom` and
  `@vitejs/plugin-react`.
- `tsconfig.json` excludes the frontend; `src/frontend/tsconfig.json` adds JSX and DOM libraries;
  `src/frontend/vite.config.ts` replaces `viewer/vite.config.ts`.
- `src/backend/render/snapshot3d.ts`, `tests/support/`, `scripts/bench-viewer.ts` and
  `scripts/compare-viewer.ts` point at the new config and module paths.
- `.github/workflows/ci.yml` runs `npm run viewer:build` in the fast job; `.gitignore` ignores
  `dist/`.
- `docs/architecture.md`, `docs/development.md`, `docs/rendering.md` and
  `docs/getting-started.md` describe the new layout, commands and viewer structure.
- No schema, model, IFC, JSON, SVG or PNG output changes are intended.
