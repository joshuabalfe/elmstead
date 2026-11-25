# Tasks

## 1. Schema and authoring contract

- [x] 1.1 Add optional `profile` to `WallSchema` (a top-edge polyline of at least two `{along, up}` points, `along` a non-negative integer strictly increasing, `up` a positive integer), make `height` optional, and refine so exactly one of `height`/`profile` is present; verify schema tests cover flat, pitched, both, neither, one point, non-increasing `along` and fractional `up`.
- [x] 1.2 Let the `wall` helper accept a `profile` top edge (and keep `height`), passing it through as a plain schema value; verify helper tests for a pitched wall and an unchanged flat wall.
- [x] 1.3 Regenerate `schema/building.schema.json` with `npm run schema`; verify the stale-JSON-Schema test passes.

## 2. Geometry and model checks

- [x] 2.1 Add top-edge helpers in `src/geometry/wall.ts`: effective height (max `up`), the lowest top over an along-range, the closed side profile and its area; verify geometry unit tests for a gable edge and a flat wall.
- [x] 2.2 Add the profile-spans-the-wall check (first `along` 0, last `along` equal to the wall length); verify check tests for a profile short of the end, one not starting at 0, and one that spans.
- [x] 2.3 Fit openings under a pitched wall's top edge (sill + height at or below the lowest top across the opening's width), flat walls unchanged; verify check tests for a window poking above the eaves and one fitting under the ridge.

## 3. IFC writer and round-trip

- [x] 3.1 Write a pitched wall's `Body` as its closed side profile extruded across the thickness, positioned by justification, leaving the flat plan-rectangle path unchanged; verify a gable wall meshes in web-ifc with the sloping top.
- [x] 3.2 Expect a pitched wall's volume as its top-edge profile area × thickness minus its openings (flat walls unchanged); verify round-trip tests for the gable volume and an unchanged flat wall.

## 4. Attic gable ends

- [x] 4.1 Add provisional eaves and ridge heights to `models/elmstead/shared.ts`, flagged as unmeasured like the basement level; verify `npm run typecheck` passes.
- [x] 4.2 Make the attic's north and south walls gable ends via `profile` (ridge over the core) and its east and west walls flat at eaves height; verify `npm run build models/elmstead/index.ts` meets all constraints and writes valid IFC, and the attic plan/3D show the gables.
- [x] 4.3 Eye-check the attic gables in the viewer on a close-up pose and confirm the ridge and eaves read correctly; capture the view URL.

## 5. Integration

- [x] 5.1 Run `npm test` and `npm run typecheck`; verify every test passes and types are clean.
- [x] 5.2 Regenerate generated files (`npm run schema`, build, render) and run `npx openspec validate --all`; verify the schema, artefacts and specs are all clean.

## Workflow follow-up

- Open a draft pull request titled `ELM-11: Add pitched walls` to reserve the number, per AGENTS.md.
- Archive the change after the project's review requirements are satisfied, and verify the archived result.
