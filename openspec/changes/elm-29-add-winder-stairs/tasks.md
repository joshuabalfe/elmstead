# Tasks

Each section below ends with `npm run typecheck`, `npm run format` and `npm run test:fast` passing, and
is committed as its own runnable step (`ELM-29: …`). Adding the schema member in 1.1 makes the
compiler flag every place that switches on a segment kind, so 1.1 also adds a placeholder in each
(a case that throws `winder: not implemented yet`, or skips it), and each later task replaces its
placeholder. No existing model has a winder, so no placeholder can run.

## 1. Schema, ids, geometry and a fixture

- [x] 1.1 Add `StairWinderSchema` (`outline`, `pivot`, `entry`, integer `risers` ≥ 2, `.meta({ id: "StairWinder" })`) to `StairSegmentSchema` in `src/shared/schema/schema.ts`, export its type, and add a placeholder wherever `npm run typecheck` then fails. Verify `npm run typecheck` passes and schema tests cover the valid, one-riser, two-point and missing-pivot cases and `kind: "spiral"` still failing. The existing "unknown kind" test in `tests/stair.test.ts` uses `"winder"` as its invalid example; change it to `"spiral"`.
- [x] 1.2 Add the winder's kind, `"stair winder"` (the `"stair "` prefix keeps the revision error's "replace its stair" hint), to `IdNode` and `idNodes` in `src/shared/schema/ids.ts`. Verify in `tests/ids.test.ts` that a winder's id is found, gets a GlobalId, is reported as a duplicate against a flight, and that the "stair segments have no place" test still holds.
- [x] 1.3 Run `npm run schema` and commit the regenerated `schema/building.schema.json`. Verify `npm test` shows no schema drift.
- [x] 1.4 In `src/shared/geometry/stair.ts`, count a winder's risers in `stairLevels` (riser height, levels and top landing rule), and add the fan: the interior fan lines, each tread's polygon (merging points within a tolerance, so a fan line through a corner repeats nothing) and its level, and the walking line. Verify with a geometry test that the treads' areas sum to the outline's, that a 3-riser square winder has fan lines at 30° and 60°, that a 2-riser one gives two triangles meeting at the far corner, and that 2200 mm over a 3-riser winder and an 8-riser flight gives 200 mm risers with the flight starting at 600 mm.
- [x] 1.5 Add a fixture model with a winder stair, a small two-storey building under `tests/fixtures/winder-stair/` (a winder of 3 risers on a square outline, then a flight, as in the `two-storey` fixture's style). Verify it loads and validates against the schema, and is used by the geometry test in 1.4.
- [x] 1.6 Verify a stair with only flights and landings is unchanged: the existing stair, IFC and plan tests and SVG snapshot pass without `-u`.

## 2. Authoring helper and checks

- [x] 2.1 Add `stairWinder(id, outline, { pivot, entry, risers })` to `src/backend/model/helpers.ts` and export it as the other helpers are, and use it in the fixture. Verify with a helper test, in the style of `tests/railing.test.ts`, for each `model-authoring` scenario.
- [x] 2.2 In `src/backend/checks/model.ts`, add winders to `outlined()` so they get the distinct-point and self-intersection checks, and add the winder rules: first segment and followed by a flight, strictly convex outline, pivot and entry as adjacent outline points, and the next flight starting on the exit edge with both ends of its start edge on it, running away from the outline. Verify with one test per scenario in the `model-checks` delta spec, and that `npm run check` on the fixture reports no ERROR.
- [x] 2.3 Verify a revision can add, replace and remove a stair with a winder, and the diff reports it, in `tests/revise.test.ts` and `tests/diff.test.ts`, using the fixture. No change to `SCHEMAS` or `COMPARED` is expected; if a test shows one is needed, make it.

## 3. IFC

- [ ] 3.1 In `src/backend/ifc/writer.ts`, add a variant of `body()` that takes several solids, write a winder as an `IfcStairFlight` of type `WINDER` with one solid per tread, aggregated under the `IfcStair`, and set the stair's type to `QUARTER_WINDING_STAIR` only for one winder and one flight with the winder turning through 90° within 1°, `NOTDEFINED` for any other stair that starts with a winder. Put a comment beside `stairType` saying why this tolerance differs from the flights'. Verify with writer tests for the type in each `ifc-export` scenario, the attributes, three solids for three risers, GlobalIds, and the colour being the stair colour (extend the existing stair-colour assertions in `tests/ifc.test.ts`).
- [ ] 3.2 Run `validator/validate.py` (IfcOpenShell with the IFC4 where-rules) on the fixture's IFC through `npm run build`. Verify it reports nothing against the winder. If a where-rule rejects `NumberOfTreads` equal to `NumberOfRisers`, change the attributes, and the `ifc-export` winder scenario with them, before going on.
- [ ] 3.3 In `src/backend/ifc/roundtrip.ts`, expect a winder's volume to be the sum of its treads' areas × heights. Verify that the fixture builds with no round-trip ERROR, and that corrupting a winder's riser count makes the volume check fail.

## 4. Plan

- [ ] 4.1 In `src/shared/render/plan.ts`, draw a winder as a `stair-winder` group: outline, tread lines on the interior fan lines and a walking arrow ending where the next flight starts; and include its outline in the drawing extent. Verify with a plan test for the group, its `data-id`, two fan lines for 3 risers, an arrow, `--ids` drawing the winder's id, and that `renderFloor`, `renderWallTops` and `renderPlanAnnotations` draw none of it.
- [ ] 4.2 Give the fixture its own plan SVG snapshot, reviewed before it is written. Verify the example cottage's snapshot is byte-identical and `tests/render.test.ts` passes without `-u` on the existing snapshots.

## 5. Viewer

- [ ] 5.1 In `src/frontend/scene/engine.ts`, move the riser-height sum out of the async model loader into a small pure function, count a winder's risers in it, and leave the top-landing sum as it is (see the design's Open Questions). Verify in `tests/viewer-presentation.test.ts` that 2200 mm over a winder of 3 risers and a flight of 8 gives 200 mm, and that a stair of flights and a top landing gives what it gave before.
- [ ] 5.2 Look at the result with the `inspect-the-rendered-output` skill: plan PNG, 3D PNGs, the winder's storey alone, plan style and `style=ifc`. Verify the winder treads read as steps in plan style, and compare the plan's treads with the 3D top view.
- [ ] 5.3 Check the plan-versus-3D comparison: stair pixels stay ignored and the storey is not skipped. Verify `tests/plan-vs-3d*.test.ts` pass with the fixture, and write the reason in `docs/rendering.md` if it needed a rule.

## 6. Docs, skills and finish

- [ ] 6.1 Update the docs that list stair parts or what is unsupported: `docs/modelling.md` (the element table's stair rows, the helper table, the Stairs section with a worked winder example, "Not modelled yet", and "Things the schema does not have yet"), `docs/ifc.md`, `docs/rendering.md`, `docs/development.md` (the unique-id kinds and the stair checks) and `docs/architecture.md` ("Stair (flights and landings)"). Verify `git grep -n -i "flights and landings\|stair landings" docs` shows nothing out of date, each documented snippet type-checks, and `npm run format:check` passes.
- [ ] 6.2 Take winders out of the lists of unsupported things in `.agents/skills/start-a-new-building-model/SKILL.md` and `.agents/skills/edit-an-existing-building-model/SKILL.md`, keeping spiral stairs. Verify with `git grep -i winder -- .agents docs`, which should show only supported uses.
- [ ] 6.3 Run `npx openspec validate --all`, `npm run typecheck`, `npm run format` and `npm test`. Verify all pass.

## Workflow follow-up

- Open a draft pull request titled `ELM-29: …` when the user asks for it; the number is not reserved on the remote until then.
- Sync the delta specs into `openspec/specs/` and archive the change after review (`openspec-sync-specs`, `openspec-archive-change`).
- Add the `williamson` model, whose stair is the first to use a winder, on top of this change.
