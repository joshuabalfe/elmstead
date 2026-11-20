# Tasks

## 1. Shared foundations

- [x] 1.1 Add `src/root.ts` with `PROJECT_ROOT` and an `outDir()` that honours `ELMSTEAD_OUT_DIR`; use it from the CLI, validator bridge and snapshot driver. Verify `build` works from the repo root and from `/tmp` with a temporary `ELMSTEAD_OUT_DIR`, and update `docs/getting-started.md`.
- [x] 1.2 Add `src/io.ts` with `writeFileAtomic(path, data)` (temp file + rename) and a unit test proving a failed write leaves the previous file intact. Verify with `npx vitest run tests/io.test.ts`.
- [x] 1.3 Add `polygonProblems(pts)` to `src/geometry/polygon.ts` covering distinct points, open outline, adjacent duplicates, zero area and self-intersection, reusing `segmentsCross`. Verify with unit tests for valid concave, repeated-point, zero-area and bow-tie outlines.

## 2. Model integrity checks

- [ ] 2.1 Add `checkIds` and `checkWalls` in `src/checks/model.ts`: unique ids across every id-bearing node (including components) and zero-length walls. Verify with tests that duplicate element/component ids and zero-length walls are ERRORs against the id.
- [ ] 2.2 Add `checkOpenings`: host wall on the same storey, offset+width within the wall length, sill+height within the wall height, and pairwise overlap on the same wall. Verify with fixtures for missing host, past the end, above the top and overlapping openings.
- [ ] 2.3 Add `checkOutlines` for rooms and slabs using `polygonProblems`. Verify with self-intersecting room and repeated-point slab fixtures.
- [ ] 2.4 Export `checkModel` (components + ids + walls + openings + outlines), run it in `build` before writing anything and in `render` before writing plans, and update `docs/development.md` and `docs/modelling.md` with the new rules. Verify that a failing model writes no files and that both commands exit 1.
- [ ] 2.5 Remove the now-unused `wallFootprint` and the unused `extent` binding, enable `noUnusedLocals` and `noUnusedParameters` in `tsconfig.json`, and fix any fallout. Verify with `npm run typecheck`.

## 3. CLI and error handling

- [ ] 3.1 Refactor model loading to return a result instead of calling `process.exit`, wrap command dispatch in a `try/catch` that turns unexpected errors into an ERROR issue, and add CLI integration tests for missing-wall and zero-length-wall fixtures. Verify that `npm test` shows formatted issues, no stack trace and no partial output.
- [ ] 3.2 Implement `check` (run `checkModel`, write nothing) and `all` (build then render, stopping on build errors), update `USAGE`, `docs/README.md` and `docs/getting-started.md`. Verify `npm run check` and `npm run all` on the cottage and on an invalid fixture.
- [ ] 3.3 Write JSON, IFC, plan SVG/PNG and snapshot PNG files through `writeFileAtomic`, and add a test that an interrupted write preserves the previous file. Verify `npm test` and that `out/` contents still match a normal build.
- [ ] 3.4 Add `tests/cli.test.ts` covering: valid build, component-check failure writes nothing, missing-host error, render-before-build warning, and `check`/`all` exit statuses. Verify with `npx vitest run tests/cli.test.ts`.

## 4. IFC verification and export

- [ ] 4.1 Make `validateIfc` parse each stdout line defensively, resolve `validator/validate.py` from `PROJECT_ROOT`, honour the validator exit status, and report non-JSON lines and missing summaries as issues. Add a fake-`uv` test for non-JSON stdout and a test for a non-zero exit without a summary. Update `docs/ifc.md`.
- [ ] 4.2 Compute the window partitioning value from the glazing grid and use it on both `IfcWindowType` and `IfcWindow`. Verify with an IFC test that the six-pane front window is `MULTIPLE_PANEL` and a plain window is `SINGLE_PANEL`; update `docs/ifc.md`.

## 5. Snapshot lifecycle

- [ ] 5.1 Restructure `snapshot3d` so the browser and Vite server close on every success and failure path; write screenshots through `writeFileAtomic`. Verify with a test that points `PLAYWRIGHT_BROWSERS_PATH` at an empty directory and asserts the process exits 0 with a WARNING and the plans still exist.
- [ ] 5.2 Classify missing Chromium as WARNING and every other viewer/snapshot failure as ERROR in `render3d`, and verify the CLI exit statuses. Update `docs/rendering.md` and `docs/getting-started.md` if the wording changes.

## 6. Viewer hardening

- [ ] 6.1 Confine the Vite middleware to its output and WASM directories using a relative-path check, and reject malformed percent-encoding without throwing. Verify with a dev-server test or an extracted helper test covering a normal file, `../` escape and a sibling `out-*` directory.
- [ ] 6.2 Validate `?view=` against the five known views and build model `<option>` elements with `textContent` instead of `innerHTML`. Verify with a viewer test or the plan-versus-3D suite plus a manual `?view=sideways` check, and update `docs/rendering.md`.
- [ ] 6.3 Run the full viewer suite (`tests/plan-vs-3d.test.ts`) and confirm the Top view still matches the plan for both models.

## 7. Elmstead model cleanup

- [ ] 7.1 Replace the repeated `mm(8975)` in `models/elmstead/ground/rooms.ts` with a named constant and replace `sub(mm(3955), southIn)` in `models/elmstead/ground/openings.ts` with a named absolute point. Verify `npm run build models/elmstead` and confirm the generated IFC is unchanged.

## 8. CI and final verification

- [ ] 8.1 Add `.github/workflows/ci.yml` with a fast job (typecheck, generated-schema freshness, fast tests) and a full job (uv + Chromium, `npm test`), with npm and uv caching. Verify the YAML parses and the commands match `package.json`.
- [ ] 8.2 Update `docs/README.md`, `docs/development.md` and `AGENTS.md` where they describe the commands, checks or test requirements.
- [ ] 8.3 Run `npm run typecheck`, `npm test` and `npx openspec validate --all`; confirm `schema/building.schema.json` is unchanged unless the schema genuinely changed, and review any SVG snapshot diff.

## Workflow follow-up

- Commit at runnable milestones on `harden-pipeline`.
- Archive the change after review and merge; verify the archived result.