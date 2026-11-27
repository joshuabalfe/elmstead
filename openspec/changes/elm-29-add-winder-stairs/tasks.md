# Tasks

## 1. Schema, ids and geometry

- [ ] 1.1 Add `StairWinderSchema` (`outline`, `pivot`, `entry`, integer `risers` ≥ 2, `.meta({ id: "StairWinder" })`) to `StairSegmentSchema` in `src/shared/schema/schema.ts`, and export its type. Verify with schema tests for the new valid, one-riser, two-point and missing-pivot cases, and for `kind: "spiral"` still failing. The existing "unknown kind" test in `tests/stair.test.ts` uses `"winder"` as its invalid example; change it to `"spiral"`.
- [ ] 1.2 Add the winder's kind to `IdNode` and `idNodes` in `src/shared/schema/ids.ts`. Verify in `tests/ids.test.ts` that a winder's id is found, gets a GlobalId and is reported as a duplicate against a flight.
- [ ] 1.3 Run `npm run schema` and commit the regenerated `schema/building.schema.json`. Verify `npm test` shows no schema drift.
- [ ] 1.4 In `src/shared/geometry/stair.ts`, count a winder's risers in `stairLevels` (riser height, levels and top landing rule), and add the fan: the interior fan lines, each tread's polygon and its level, and the walking line. Verify with a geometry test that the treads' areas sum to the outline's, that a 3-riser square winder has fan lines at 30° and 60°, and that 2200 mm over a 3-riser winder and an 8-riser flight gives 200 mm risers with the flight starting at 600 mm.
- [ ] 1.5 Verify a stair with only flights and landings is unchanged: the existing stair, IFC and plan tests and SVG snapshot pass without `-u`.

## 2. Authoring helper and checks

- [ ] 2.1 Add `stairWinder(id, outline, { pivot, entry, risers })` to `src/backend/model/helpers.ts` and export it as the other helpers are. Verify with a helper test, in the style of `tests/railing.test.ts`.
- [ ] 2.2 In `src/backend/checks/model.ts`, add the winder rules: first segment and followed by a flight, outline (three distinct points, convex, no self-intersection), pivot and entry as adjacent outline points, and the next flight starting on the exit edge within 1 mm. Verify with one test per scenario in the `model-checks` delta spec.
- [ ] 2.3 Verify a revision can add, replace and remove a stair with a winder, and the diff reports it, in `tests/revise.test.ts` and `tests/diff.test.ts`. No change to `SCHEMAS` or `COMPARED` is expected; if a test shows one is needed, make it.

## 3. IFC

- [ ] 3.1 In `src/backend/ifc/writer.ts`, write a winder as an `IfcStairFlight` of type `WINDER` with one solid per tread, aggregated under the `IfcStair`, and set the stair's type to `QUARTER_WINDING_STAIR` for a winder turning through 90° within 1°, `NOTDEFINED` otherwise. Verify with writer tests for the type, the attributes, three solids for three risers, GlobalIds, and `NumberOfTreads` equal to the risers.
- [ ] 3.2 In `src/backend/ifc/roundtrip.ts`, expect a winder's volume to be the sum of its treads' areas × heights. Verify that a model with a winder builds with no round-trip ERROR, and that corrupting a winder's riser count makes the volume check fail.
- [ ] 3.3 Verify the winder's IFC colour equals the stair colour, so it is not read as a wall or slab (`tests` for IFC colours).

## 4. Plan

- [ ] 4.1 In `src/shared/render/plan.ts`, draw a winder as a `stair-winder` group: outline, tread lines on the interior fan lines and a walking arrow; and include its outline in the drawing extent. Verify with a plan test for the group, its `data-id`, two fan lines for 3 risers, and an arrow, and that `renderFloor`, `renderWallTops` and `renderPlanAnnotations` draw none of it.
- [ ] 4.2 Add a stair winder to a test fixture and update the plan SVG snapshot only for that fixture (`npx vitest run -u` after reviewing the diff). Verify the example cottage's snapshot is byte-identical.

## 5. Viewer

- [ ] 5.1 In `src/frontend/scene/engine.ts`, count a winder's risers when computing the stair riser height used for banding. Verify in `tests/viewer-presentation.test.ts` that a stair with a winder and a flight gets the same band height as its levels give.
- [ ] 5.2 Look at the result with the `inspect-the-rendered-output` skill: plan PNG, 3D PNGs, the winder's storey alone, plan style and `style=ifc`. Verify the winder treads read as steps in plan style, and compare the plan's treads with the 3D top view.
- [ ] 5.3 Check the plan-versus-3D comparison: stair pixels stay ignored and the storey is not skipped. Verify `tests/plan-vs-3d*.test.ts` pass, and write the reason in `docs/rendering.md` if it needed a rule.

## 6. Docs, skill and finish

- [ ] 6.1 Update `docs/modelling.md` (the stair shape table and Stairs section with a worked winder example, and remove winders from "Not modelled yet" and "Things the schema does not have yet"), `docs/ifc.md` and `docs/rendering.md`. Verify each documented snippet type-checks, and `npm run format:check` passes.
- [ ] 6.2 Take winders out of the lists of unsupported things in `.agents/skills/start-a-new-building-model/SKILL.md` and `.agents/skills/edit-an-existing-building-model/SKILL.md`, keeping spiral stairs. Verify with `git grep -i winder -- .agents docs`, which should show only supported uses.
- [ ] 6.3 Run `npx openspec validate --all`, `npm run typecheck`, `npm run format` and `npm test`. Verify all pass.

## Workflow follow-up

- Sync the delta specs into `openspec/specs/` and archive the change after review (`openspec-sync-specs`, `openspec-archive-change`).
- Add the `williamson` model, whose stair is the first to use a winder, on top of this change.
