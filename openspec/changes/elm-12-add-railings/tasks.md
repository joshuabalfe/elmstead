# Tasks

## 1. Schema and derived geometry

- [ ] 1.1 Add `RailingSchema` (id, optional name, start, end, positive `height` to the top of the
  rail, optional non-negative `startBase`/`endBase` where an omitted base is 0) and
  `railings: z.array(RailingSchema).optional()` to `StoreySchema` in `src/schema/schema.ts`. Add
  schema tests for a level railing with both bases omitted, a sloped railing with `endBase: 600`
  and no `startBase`, a partial base pair, and rejected zero height and negative base. Run
  `npm run schema` and verify the stale-schema test and every existing model still validate.
- [ ] 1.2 Add `src/geometry/railing.ts`: the plan run, the 3D rail line, the vertical offset from
  the rail's top surface to its centreline, post positions (both ends plus evenly spaced
  intermediates; intervals = max(1, ceil(planRun / 1200))), and part volumes (rail 3D length × 50 ×
  40 mm, posts 40 × 40 × height). A zero plan run is reported for the check, not silently handled.
  Add unit tests for level, sloped, post count, rail length, the 890–900 mm height above the front
  flight's nosings, and zero run; verify `npx vitest run tests/railing.test.ts` passes.
- [ ] 1.3 Add `railing(id, start, end, { height, startBase?, endBase? })` to `src/model/helpers.ts`:
  record the bases exactly as given, omit both when neither is given, and compute no derived
  geometry. Add tests for both omitted, both given and one given; verify
  `npx vitest run tests/helpers.test.ts` passes.

## 2. Model checks

- [ ] 2.1 Add railings to `idEntries` and a `checkRailings` that reports a zero-plan-run ERROR in
  `src/checks/model.ts`. Add checks tests for a duplicate railing id and a zero-length railing;
  verify `npx vitest run tests/checks.test.ts` passes.

## 3. IFC export and verification

- [ ] 3.1 Add a `railing` entry to `STYLES` (`src/ifc/styles.ts`) at least 0.02 in RGB distance
  from every other entry. Extend the style-distinctness test; verify
  `npx vitest run tests/ifc.test.ts` passes.
- [ ] 3.2 Write each railing as an `IfcRailing` contained in its storey: `HANDRAIL` when the
  effective bases differ (an omitted base is 0), `GUARDRAIL` when equal; the rail's top surface at
  `height`, with its local Z along the 3D run, a horizontal ref direction across it and the 3D
  length as extrusion depth; posts from the walking surface to the rail top. `Tag` = id and
  `Name` = name or id. Add IFC tests for the entity, both predefined types, tag/name, styling, and
  the rail's axis/ref direction/depth (a volume-only test cannot catch a vertical box); verify they
  pass.
- [ ] 3.3 Add the railing's rail and post volumes to `roundTripChecks` in `src/ifc/roundtrip.ts`
  using the shared geometry functions: 3D length × 50 × 40 mm plus 40 × 40 × height per post,
  counting the post/rail overlap the same way in the expected and mesh volumes. Add a sloped
  railing round-trip test; verify `npx vitest run tests/ifc.test.ts` passes.
- [ ] 3.4 Build `models/example-cottage` before and after the change and diff the IFC bytes to
  confirm a model without railings is byte-identical; verify its round-trip is unchanged.

## 4. Plan rendering and viewer presentation

- [ ] 4.1 Add `C.railing` to the plan palette; give `makeView` a railing-extent option so
  `renderPlan` includes railing endpoints while the shared overlay renderers keep their existing
  extent; draw each railing after walls/openings and before stairs as a line with 40 mm post ticks
  in a `railing` group with its `data-id`, and draw its id with `--ids`. Add plan tests for a
  synthetic railing outside every room/slab/stair (plan extent includes it; overlay bounds equal
  the same storey without it), the railing/stair group order, no railing in the shared renderers,
  and the id label with and without the flag; verify `npx vitest run tests/render.test.ts` passes.
- [ ] 4.2 Add a plan-versus-3D unit check that `C.railing` classifies as neither wall, room nor
  paper, keep the synthetic railing clear of walls (a railing over a wall would mask its pixels;
  accepted), and confirm the comparison stays live and unchanged for models without railings.
  Verify `npx vitest run tests/plan-vs-3d.test.ts -t "plan colours"` passes.
- [ ] 4.3 Viewer: add railing ids to `applyStoreyVisibility`'s owner map and railing points to
  `shownBox`. Add a browser test that shows the railing colour in the Top view with the street
  storey shown, hides the railings when the street storey is hidden, and includes an outlying
  railing in the framed bounds; extend the hidden-storey identity test to hide the street with its
  railings. Verify the new tests pass and the street storey's overlay is unchanged.

## 5. Elmstead front-step railings

- [ ] 5.1 Record the provisional 900 mm railing height and the nosing-line base convention beside
  the model in `models/elmstead/shared.ts` with a note. Add two railings to
  `models/elmstead/street.ts` running alongside the flight: start 20 mm up the flight (so the
  bottom post sits wholly on the first tread), end at the wall; 50 mm inside each flight edge;
  `startBase: frontStepRiser` (150), `endBase: frontStepRisers × frontStepRiser` (600), height
  900. Verify `npm run check models/elmstead` and `npm run all models/elmstead` pass.
- [ ] 5.2 Add elmstead integration assertions: the street plan has both `railing` groups and their
  `--ids` labels, the IFC round-trip includes their rail and post volumes, and hiding the street
  storey hides them. Verify `npm test` passes.
- [ ] 5.3 Eye-check the street plan, Top view, a 3D view and close-ups of the bottom and top posts
  in the viewer (`npm run view`): the rail follows the nosings, the bottom post sits on the first
  tread, the top post is wall-fixed, the rail is wholly on the steps, and hiding/showing the street
  hides/shows the railings. Confirm snapshot framing is unchanged and regenerate and review any
  committed snapshot that changed.

## 6. Documentation

- [ ] 6.1 Document railings in `docs/modelling.md`: add `railings`/`Railing` to the element table,
  add `railing` to the helpers table, add a short section with a level and a sloped example
  (omitted base = 0, height to the top of the rail), and remove railings from both not-modelled
  mentions. Update `docs/rendering.md`'s drawing order, class list, shared-renderer paragraph and
  railing colour. Verify the documented examples type-check against the schema and match the helper
  signature.

## 7. Integration

- [ ] 7.1 Run `npm test` and `npm run typecheck`; regenerate `schema/building.schema.json` and any
  snapshot that changed, review the diffs, and run `npx openspec validate --all` and
  `npx openspec validate elm-12-add-railings --strict`. Verify all pass.

## Workflow follow-up

- Commit the plan revision on branch `elm-12-add-railings` and push it to draft PR #44 when asked.
- Archive the change after review and merge, syncing its deltas into `openspec/specs/`.
