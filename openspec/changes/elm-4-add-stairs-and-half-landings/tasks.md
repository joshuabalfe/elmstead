# Tasks

## 1. Schema and authoring

- [ ] 1.1 Add `Stair`, `StairFlight` and `StairLanding` strict zod schemas and an optional `stairs` array on `Storey`; verify schema tests cover a valid half-turn stair and invalid segment kind, riser count and landing outline
- [ ] 1.2 Export the new inferred types and run `npm run schema`; verify `tests/schema.test.ts` passes against a fresh JSON Schema export
- [ ] 1.3 Add `stairFlight`, `stairLanding` and `stair` helpers and export them from `src/model/index.ts`; verify helper tests assert the segment order and `toStoreyId`
- [ ] 1.4 Document the stair element and its derived dimensions in `docs/modelling.md` and update the small-schema list in `docs/architecture.md`; verify the documented example matches the helpers used by the fixture

## 2. Geometry and derivation

- [ ] 2.1 Add a stair geometry helper that derives the riser height, each flight's going and the level of every segment from the two storeys; verify tests cover 3050 mm / 16 risers, fractional going and the final level meeting the target storey
- [ ] 2.2 Add helpers for a flight's plan footprint, tread lines and stepped side profile, including its area; verify tests cover the profile area, a reversed flight and a single-flight stair

## 3. IFC export and verification

- [ ] 3.1 Write `IfcStair`, one `IfcStairFlight` per flight and one `IfcSlab` (`LANDING`) per landing, aggregated with `IfcRelAggregates`; verify IFC tests assert ShapeType, flight attributes, GlobalIds and a clean IfcOpenShell validation
- [ ] 3.2 Give flights and landings their display colours and the stair container no body; verify the IFC test asserts the container has no representation and the parts are styled
- [ ] 3.3 Extend the round-trip with stepped-profile × width and landing-outline × thickness volumes, exempting the stair container; verify tests catch a missing flight body and a wrong landing volume
- [ ] 3.4 Add the stair, flight and landing mapping to `docs/ifc.md`; verify the documented entities and GlobalId keys match the IFC test assertions

## 4. Plan rendering

- [ ] 4.1 Include stair points in the plan extent and draw flight footprints, tread lines, landing outlines and walking-direction arrows with `stair`/`stair-flight`/`stair-landing` groups and ids; verify renderer tests cover a half-turn stair, `--ids` and a stair outside the room outlines
- [ ] 4.2 Confirm stair plan colours are distinct from wall, room and paper so the plan-vs-3D comparison ignores them; verify the comparison test still passes with the stair fixture
- [ ] 4.3 Update the SVG snapshot if the renderer changes existing output and document stair symbols in `docs/rendering.md`; verify the reviewed snapshot and the documented symbols match the output

## 5. Model checks

- [ ] 5.1 Add `checkStairs` for the target storey, segment alternation, non-zero flight runs and landing adjacency, and register it in `checkModel`; verify each rule has a failing and passing test
- [ ] 5.2 Extend the model-wide id check to stair, flight and landing ids; verify duplicate-flight and duplicate-landing tests report against the id
- [ ] 5.3 Run `npm run check` on the stair fixture; verify it reports no errors and a broken fixture reports the expected stair error

## 6. Fixture and integration

- [ ] 6.1 Add a two-storey fixture with a half-turn stair and a 3050 mm rise; verify `npm run build` and `npm run render` complete and the plan and 3D PNGs show the stair
- [ ] 6.2 Add the fixture to the IFC, renderer, checks and plan-vs-3D integration coverage; verify the full suite includes it without changing the example cottage snapshot
- [ ] 6.3 Run `npm test`, `npm run typecheck`, `npm run schema` and `npx openspec validate --all`; verify all pass and generated files are committed

## Workflow follow-up

- Archive the change after implementation and the project's review requirements are satisfied.
- Verify the archived result and the change counter.