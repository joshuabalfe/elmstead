# Tasks

## 1. Shared foundations

- [x] 1.1 Add `src/root.ts` with `PROJECT_ROOT` and an `outDir()` that honours `ELMSTEAD_OUT_DIR`; use it from the CLI, validator bridge and snapshot driver. Verify `build` works from the repo root and from `/tmp` with a temporary `ELMSTEAD_OUT_DIR`, and update `docs/getting-started.md`.
- [x] 1.2 Add `src/io.ts` with `writeFileAtomic(path, data)` (temp file + rename) and a unit test proving a failed write leaves the previous file intact. Verify with `npx vitest run tests/io.test.ts`.
- [x] 1.3 Add `polygonProblems(pts)` to `src/geometry/polygon.ts` covering distinct points, open outline, adjacent duplicates, zero area and self-intersection, reusing `segmentsCross`. Verify with unit tests for valid concave, repeated-point, zero-area and bow-tie outlines.

## 2. Model integrity checks

- [x] 2.1 Add `checkIds` and `checkWalls` in `src/checks/model.ts`: unique ids across every id-bearing node, reporting both kinds, and zero-length walls; keep the existing component-id message by moving that rule out of `checkComponents`. Verify with tests that duplicate element/component ids and zero-length walls are ERRORs against the id.
- [x] 2.2 Add `checkOpenings`: host wall on the same storey, offset+width within the wall length, sill+height within the wall height, and pairwise overlap on the same wall. Verify with fixtures for missing host, past the end, above the top and overlapping openings.
- [x] 2.3 Add `checkOutlines` for rooms and slabs using `polygonProblems`. Verify with self-intersecting room and repeated-point slab fixtures.
- [x] 2.4 Export `checkModel` (components + ids + walls + openings + outlines), run it in `build` before writing anything and in `render` before writing plans, and update `docs/development.md` and `docs/modelling.md` with the new rules. Verify that a failing model writes no files and that both commands exit 1.
- [x] 2.5 Remove the now-unused `wallFootprint` and the unused `extent` binding, enable `noUnusedLocals` and `noUnusedParameters` in `tsconfig.json`, and fix any fallout. Verify with `npm run typecheck`.

## 3. CLI and error handling

- [x] 3.1 Remove the CLI `load()` wrapper's `process.exit`, wrap command dispatch in a `try/catch` that turns unexpected pipeline errors into an ERROR issue while keeping model-evaluation stacks inside their issue, and add CLI integration tests for missing-wall and zero-length-wall fixtures. Verify that `npm test` shows formatted issues, no pipeline stack trace and no partial output.
- [x] 3.2 Implement `check` (run `checkModel`, write nothing) and `all` (build then render, stopping on build errors), update `USAGE`, `docs/README.md` and `docs/getting-started.md`. Verify `npm run check` and `npm run all` on the cottage and on an invalid fixture.
- [x] 3.3 Write JSON, IFC, plan SVG/PNG and snapshot PNG files through `writeFileAtomic` using a per-process temp name and cleaning it up on failure; add a test that an interrupted write preserves the previous file. Build JSON and IFC in memory before writing either, and reload the viewer on `add` as well as `change`. Verify `npm test` and that `out/` contents still match a normal build.
- [x] 3.4 Add `tests/cli.test.ts` covering: valid build, component-check failure writes nothing, missing-host error, render-before-build warning, and `check`/`all` exit statuses. Verify with `npx vitest run tests/cli.test.ts`.

## 4. IFC verification and export

- [x] 4.1 Make `validateIfc` parse each stdout line defensively, resolve `validator/validate.py` from `PROJECT_ROOT`, honour the validator exit status, and report non-JSON lines and missing summaries as issues. Add a fake-`uv` test for non-JSON stdout and a test for a non-zero exit without a summary. Update `docs/ifc.md`.
- [x] 4.2 Map the glazing grid to IFC4 partitioning values (`SINGLE_PANEL`, the two- and three-panel doubles/triples, else `USERDEFINED` with `UserDefinedPartitioningType`) and use the same value on both `IfcWindowType` and `IfcWindow`. Verify with IFC tests that a plain window is `SINGLE_PANEL`, a two-column window is `DOUBLE_PANEL_VERTICAL`, and a six-pane 3×2 window is `USERDEFINED` with `"3x2 grid"`; update `docs/ifc.md`.

## 5. Snapshot lifecycle

- [x] 5.1 Restructure `snapshot3d` so the browser and Vite server close on every success and failure path; write screenshots through `writeFileAtomic`. Verify with a test that points `PLAYWRIGHT_BROWSERS_PATH` at an empty directory and asserts the process exits 0 with a WARNING and the plans still exist.
- [x] 5.2 Classify missing Chromium as WARNING and every other viewer/snapshot failure as ERROR in `render3d`, and verify the CLI exit statuses. Update `docs/rendering.md` and `docs/getting-started.md` if the wording changes.

## 6. Viewer hardening

- [x] 6.1 Confine the Vite middleware to its output and WASM directories using a relative-path check, and reject malformed percent-encoding without throwing. Verify with a dev-server test or an extracted helper test covering a normal file, `../` escape and a sibling `out-*` directory.
- [x] 6.2 Validate `?view=` against the five known views and build model `<option>` elements with `textContent` instead of `innerHTML`. Verify with a viewer test or the plan-versus-3D suite plus a manual `?view=sideways` check, and update `docs/rendering.md`.
- [x] 6.3 Run the full viewer suite (`tests/plan-vs-3d.test.ts`) and confirm the Top view still matches the plan for both models.

## 7. Elmstead model cleanup

- [x] 7.1 Replace the repeated `mm(8975)` in `models/elmstead/ground/rooms.ts` with a named constant and replace `sub(mm(3955), southIn)` in `models/elmstead/ground/openings.ts` with a named absolute point. Verify `npm run build models/elmstead` and confirm the generated IFC is unchanged.

## 8. CI and final verification

- [x] 8.1 Add `.github/workflows/ci.yml` with a fast job (typecheck, generated-schema freshness, fast tests) and a full job (uv + Chromium, `npm test`), with npm and uv caching. Verify the YAML parses and the commands match `package.json`.
- [x] 8.2 Update `docs/README.md`, `docs/development.md` and `AGENTS.md` where they describe the commands, checks or test requirements.
- [x] 8.3 Run `npm run typecheck`, `npm test` and `npx openspec validate --all`; confirm `schema/building.schema.json` is unchanged unless the schema genuinely changed, and review any SVG snapshot diff.

## Workflow follow-up

- Commit at runnable milestones on `harden-pipeline`.
- Archive the change after review and merge; verify the archived result.