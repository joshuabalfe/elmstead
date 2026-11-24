# Tasks

## 1. Schema: slab material and external-storey docs

- [x] 1.1 Add an optional `material` enum (`concrete` | `ground`, default `concrete`) to `Slab` in
  `src/schema/schema.ts`; add schema tests for ground accepted, omitted defaulting to concrete, and
  an unknown value rejected. Verify the new schema tests pass.
- [x] 1.2 Regenerate `schema/building.schema.json` with `npm run schema`; verify the stale-schema
  test passes and every existing model still validates unchanged.
- [x] 1.3 Document the external-storey pattern and `Slab.material` in `docs/modelling.md` (element
  table plus a short external-works note) and drop "front steps" from its not-modelled list. Verify
  the docs match the schema and the external-storey spec.

## 2. IFC presentation for ground

- [x] 2.1 Add a `ground` entry to `STYLES` (`src/ifc/styles.ts`) at least 0.02 RGB from every other
  entry, and colour slabs by material in `src/ifc/writer.ts` (default concrete). Verify an IFC test
  shows a ground slab styled with the ground colour and distinct from every entry; build
  `models/example-cottage` before and after and diff the IFC bytes (there is no committed IFC golden;
  the existing test only checks determinism), and confirm the round-trip is unchanged.

## 3. Plan rendering for ground

- [x] 3.1 Add a ground colour to the plan palette (`src/render/style.ts`) and fill ground slabs in
  the floor layer in both `renderPlan` and `renderFloor` (`src/render/plan.ts`). Verify a plan test
  shows the ground fill distinct from room fills, and the viewer's floor overlay reads ground
  rather than room fill.
- [x] 3.2 Add or confirm a classifier unit check in `tests/support/plan-vs-3d.ts` that a
  ground-colour pixel classifies as neither wall, room nor paper (runnable without a model). The
  plan-versus-3D comparison is live and has no snapshots; confirm the cottage plan SVG is unchanged
  (the cottage has no ground).

## 4. Viewer presentation for ground

- [x] 4.1 Teach `styleOf` (`viewer/main.ts`) to recognise the ground material and present it in the
  ground colour in 3D and as a floor fill in plan style, handling its tops like a slab's. Verify a
  viewer test shows ground in the ground colour in 3D and plan style and not matched to wall, slab
  or stair.
- [x] 4.2 Keep the shared-riser stair banding and correct its code comments to describe the
  limitation (one riser per model, taken from the first stair). Verify the existing stair
  readability test still passes: `npx vitest run tests/plan-vs-3d.test.ts -t "stair readability"`.

## 5. Synthetic fixture and integration

- [x] 5.1 Add a synthetic test model with a below-grade street storey, a front-steps stair to the
  ground storey and a ground slab. Verify it builds, passes the model checks, renders plans and 3D
  snapshots, and round-trips through IFC.
- [x] 5.2 With the fixture present, verify walk-mode entry stands at street level and snapshots
  still frame the house; eye-check the snapshots and the viewer URL.
- [x] 5.3 Run `npm test` and `npm run typecheck`; verify both pass, and regenerate any committed
  snapshot that changed, reviewing it rather than updating blind.

## 6. elmstead front steps

- [x] 6.1 Record the owner's four front steps and the provisional 150 mm riser (a 600 mm drop) beside
  the model in `models/elmstead/shared.ts`, with a note; constraints hold distances, not step counts.
  Verify `npm run check models/elmstead` passes.
- [x] 6.2 Add the street storey, front-steps stair and ground slab to `models/elmstead` using four
  risers, with the ground only in front of the house (no slab under the basement). Verify
  `npm run check models/elmstead` and `npm run all models/elmstead` pass.
- [x] 6.3 Update the tests that assume the ground floor is lowest and every storey has walls: the
  floor-structure loop (`tests/elmstead.test.ts`), the per-storey plan-vs-3D loop and the centreline
  fixture (skip wall-less storeys, select the ground storey by id, `tests/plan-vs-3d.test.ts`) and
  the storey-selector expectation. Verify `npm test` passes.
- [x] 6.4 Run `npm test` and `npm run typecheck`; verify both pass, and eye-check the front steps,
  the ground and both stairs' banding in the plans, 3D snapshots and viewer.

## Workflow follow-up

- PR #38 is open as a draft on branch `elm-10-add-external-storey`; mark it ready when implementation
  is complete.
- Archive the change after review requirements are satisfied, syncing its delta specs into
  `openspec/specs/`.