# Tasks

## 1. Schema and derived geometry

- [ ] 1.1 Add `RailingSchema` (id, optional name, start, end, positive height, optional
  non-negative `startBase`/`endBase`) and `railings: z.array(RailingSchema).optional()` to
  `StoreySchema` in `src/schema/schema.ts`. Add schema tests for a valid level and sloped railing,
  an omitted array, and rejected zero height and negative base. Run `npm run schema` and verify the
  stale-schema test and every existing model still validate.
- [ ] 1.2 Add `src/geometry/railing.ts` with the plan run, the 3D rail line, post positions (both
  ends plus evenly spaced intermediates at no more than 1200 mm) and part volumes (rail 50 × 40 mm,
  posts 40 × 40 mm). Add unit tests for a level run, a sloped run, the post count, the rail length
  and zero-run handling; verify `npx vitest run tests/railing.test.ts` passes.
- [ ] 1.3 Add `railing(id, start, end, { height, startBase?, endBase? })` to `src/model/helpers.ts`
  as plain sugar that records the given points, height and bases (omitting both bases when level and
  unspecified). Add a helper test; verify `npx vitest run tests/helpers.test.ts` passes.

## 2. Model checks

- [ ] 2.1 Add railings to `idEntries` and a `checkRailings` that reports a zero-plan-run ERROR in
  `src/checks/model.ts`. Add checks tests for a duplicate railing id and a zero-length railing;
  verify `npx vitest run tests/checks.test.ts` passes.

## 3. IFC export and verification

- [ ] 3.1 Add a `railing` entry to `STYLES` (`src/ifc/styles.ts`) at least 0.02 in RGB distance
  from every other entry. Extend the style-distinctness test; verify
  `npx vitest run tests/ifc.test.ts` passes.
- [ ] 3.2 Write each railing as an `IfcRailing` contained in its storey: `HANDRAIL` when the bases
  differ, `GUARDRAIL` when equal; a body of the sloped or level top rail plus posts, all styled
  `railing`; `Tag` = id and `Name` = name or id. Add IFC tests for the entity, predefined type,
  tag/name, styling and body; verify they pass.
- [ ] 3.3 Add the railing's rail and post volumes to `roundTripChecks` in `src/ifc/roundtrip.ts`
  using the shared geometry functions. Add a test that a railing round-trips with the expected
  volume; verify `npx vitest run tests/ifc.test.ts` passes.
- [ ] 3.4 Build `models/example-cottage` before and after the change and diff the IFC bytes to
  confirm a model without railings is byte-identical; verify its round-trip is unchanged.

## 4. Plan rendering and viewer presentation

- [ ] 4.1 Add `C.railing` to the plan palette, include railing endpoints in `makeView`, and draw
  each railing in `renderPlan` as a line with a 40 mm tick at each post, in a `railing` SVG group
  with its `data-id`, after walls and before stairs. Add plan tests for the group, the extent and
  the shared renderers emitting no railing; verify `npx vitest run tests/render.test.ts` passes.
- [ ] 4.2 Add a plan-versus-3D unit check that `C.railing` classifies as neither wall, room nor
  paper, and confirm the comparison stays live and unchanged for models without railings. Verify
  `npx vitest run tests/plan-vs-3d.test.ts -t "plan colours"` passes.

## 5. Elmstead front-step railings

- [ ] 5.1 Record a provisional 900 mm railing height beside the front steps in
  `models/elmstead/shared.ts` with a note, and add two railings to `models/elmstead/street.ts`
  running alongside the flight, inset 25 mm from its edges, with bases 0 → 600 mm derived from
  `frontStepRisers × frontStepRiser`. Verify `npm run check models/elmstead` and
  `npm run all models/elmstead` pass.
- [ ] 5.2 Add elmstead integration assertions: the street plan has both `railing` groups, and the
  IFC round-trip includes their rail and post volumes. Verify `npm test` passes.
- [ ] 5.3 Eye-check the street plan, Top view, a 3D view and a close-up of the steps in the viewer
  (`npm run view`), including that the railings sit on the steps and read in plan style; confirm
  snapshot framing is unchanged. Regenerate and review any committed snapshot that changed.

## 6. Documentation

- [ ] 6.1 Document railings in `docs/modelling.md`: add `railings`/`Railing` to the element
  table, a short section with a level and a sloped example, and remove railings from the
  not-modelled list. Note the plan symbol and railing colour in `docs/rendering.md`. Verify the
  documented examples type-check against the schema and match the helper signature.

## 7. Integration

- [ ] 7.1 Run `npm test` and `npm run typecheck`; regenerate `schema/building.schema.json` and any
  snapshot that changed, review the diffs, and run `npx openspec validate --all`. Verify all pass.

## Workflow follow-up

- Commit the plan on branch `elm-12-add-railings` and open a draft `ELM-12:` PR when asked to push.
- Archive the change after review and merge, syncing its deltas into `openspec/specs/`.
