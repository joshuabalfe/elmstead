# Tasks

## 1. Schema and authoring

- [x] 1.1 Add `Stair`, `StairFlight` and `StairLanding` strict zod schemas and an optional `stairs` array on `Storey`; verify schema tests cover a valid half-turn stair and invalid segment kind, riser count and landing outline
- [x] 1.2 Export the new inferred types and run `npm run schema`; verify `tests/schema.test.ts` passes against a fresh JSON Schema export
- [x] 1.3 Add `stairFlight`, `stairLanding` and `stair` helpers and export them from `src/model/index.ts`; verify helper tests assert the segment order and `toStoreyId`
- [x] 1.4 Document the stair element and its derived dimensions in `docs/modelling.md`, drop stairs from its list of things the schema cannot express, and update the small-schema list in `docs/architecture.md`; verify the documented example matches the helpers used by the fixture and no doc still lists stairs as unmodelled

## 2. Geometry and derivation

- [x] 2.1 Add a stair geometry helper that derives the riser height, each flight's going and the level of every segment from the two storeys, returning plain `number` millimetres rather than branded `Mm`; verify tests cover 3050 mm / 16 risers giving 190.625, an uneven 9-and-7 split still ending on the target storey, fractional going, and that no `mm()`, `div()` or `divRound()` call touches a derived value
- [x] 2.2 Add helpers for a flight's plan footprint, tread lines and stepped side profile, including its area; verify tests cover the profile area, a reversed flight and a single-flight stair

## 3. IFC export and verification

- [x] 3.1 Write `IfcStair`, one `IfcStairFlight` per flight and one `IfcSlab` (`LANDING`) per landing, aggregated with `IfcRelAggregates`; verify IFC tests assert the stair's `PredefinedType`, each flight's `NumberOfRisers`, `NumberOfTreads`, `RiserHeight` and `TreadLength` — the IFC4 names, not IFC2x3's `ShapeType` and `NumberOfRiser` — plus GlobalIds and a clean IfcOpenShell validation
- [x] 3.2 Give flights and landings their display colours and the stair container no body; verify the IFC test asserts the container has no representation and the parts are styled
- [x] 3.3 Extend the round-trip with stepped-profile × width and landing-outline × thickness volumes, exempting the stair container; verify tests catch a missing flight body and a wrong landing volume
- [x] 3.4 Add the stair, flight and landing mapping to `docs/ifc.md`; verify the documented entities, IFC4 attribute names and GlobalId keys match the IFC test assertions

## 4. Plan rendering

- [x] 4.1 Include stair points in the plan extent and draw flight footprints, tread lines, landing outlines and walking-direction arrows with `stair`/`stair-flight`/`stair-landing` groups and ids, in `renderPlan` only; verify renderer tests cover a half-turn stair, `--ids`, a stair outside the room outlines, and that neither `renderFloor` nor `renderWallTops` — which `viewer/main.ts` composites into its plan-style overlay — emits any stair group
- [x] 4.2 Pick stair colours that survive the plan-vs-3D comparison: on the plan, off `C.wall`, `C.room` and `C.paper` so stair pixels classify as other and are skipped; in `STYLES`, at least 0.02 RGB distance from every existing entry so the viewer's `styleOf` does not patch stair tops as walls or discard them as slabs; verify the comparison test still passes with the stair fixture and a unit test asserts both distances
- [x] 4.3 Update the SVG snapshot if the renderer changes existing output and document stair symbols in `docs/rendering.md`; verify the reviewed snapshot and the documented symbols match the output

## 5. Model checks

- [x] 5.1 Add `checkStairs` for the target storey being the next one up, segment alternation, non-zero flight runs and landing adjacency, and add landing outlines to `checkOutlines`, then register both in `checkModel`; verify each rule has a failing and passing test, including a stair that skips a storey and a self-intersecting landing, and that `risers < 2` stays a schema failure rather than a check
- [x] 5.2 Extend the model-wide id check to stair, flight and landing ids, as three more entries in `idEntries` rather than a new rule; verify duplicate-flight and duplicate-landing tests report against the id naming both kinds
- [x] 5.3 Run `npm run check` on the stair fixture; verify it reports no errors and a broken fixture reports the expected stair error

## 6. Fixture and integration

- [x] 6.1 Add the folder model `models/example-two-storey/index.ts`: two storeys, a half-turn stair and a 3050 mm rise — a folder like every model the tests import, under `models/` rather than `tests/fixtures/`, which holds only invalid models, and with no constraints file, which is optional; verify `npm run build` and `npm run render` complete and the plan and 3D PNGs show the stair
- [x] 6.2 Add the fixture to the IFC, renderer, checks and plan-vs-3D integration coverage, including the model list in `tests/plan-vs-3d.test.ts`; verify the full suite includes it without changing `example-cottage.storey-ground.plan.svg`
- [x] 6.3 Run `npm test`, `npm run typecheck`, `npm run schema` and `npx openspec validate --all`; verify all pass and generated files are committed

## Workflow follow-up

- Archive the change after implementation and the project's review requirements are satisfied.
- Verify the archived result.