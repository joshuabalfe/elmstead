# Tasks

## 1. Schema: slab material and external-storey docs

- [ ] 1.1 Add an optional `material` enum (`concrete` | `ground`, default `concrete`) to `Slab` in
  `src/schema/schema.ts`; add schema tests for ground accepted, omitted defaulting to concrete, and
  an unknown value rejected. Verify the new schema tests pass.
- [ ] 1.2 Regenerate `schema/building.schema.json` with `npm run schema`; verify the stale-schema
  test passes and every existing model still validates unchanged.
- [ ] 1.3 Document the external-storey pattern and `Slab.material` in `docs/modelling.md` (element
  table plus a short external-works note) and drop "front steps" from its not-modelled list. Verify
  the docs match the schema and the external-storey spec.

## 2. IFC presentation for ground

- [ ] 2.1 Add a `ground` entry to `STYLES` (`src/ifc/styles.ts`) at least 0.02 RGB from every other
  entry, and colour slabs by material in `src/ifc/writer.ts` (default concrete). Verify an IFC test
  shows a ground slab styled with the ground colour, a concrete slab byte-identical to before, and
  the ground colour distinct from every other entry; confirm the example cottage IFC and round-trip
  are unchanged.

## 3. Plan rendering for ground

- [ ] 3.1 Add a ground colour to the plan palette (`src/render/style.ts`) and fill ground slabs in
  the floor layer (`src/render/plan.ts`). Verify a plan test shows the ground fill distinct from room
  fills.
- [ ] 3.2 Confirm ground pixels classify as neither wall, room nor paper in
  `tests/support/plan-vs-3d.ts` (so the comparison skips them), and regenerate the affected plan SVG
  and plan-versus-3D snapshots with review. Verify `npm test` passes on the reviewed snapshots.

## 4. Viewer presentation for ground

- [ ] 4.1 Teach `styleOf` (`viewer/main.ts`) to recognise the ground material and present it in the
  ground colour in 3D and as a floor fill in plan style, handling its tops like a slab's. Verify a
  viewer test shows ground green in 3D and plan style and not matched to wall, slab or stair.
- [ ] 4.2 With a ground slab present, verify walk-mode entry stands at street level and snapshots
  still frame the house; eye-check the snapshots and the viewer URL.

## 5. Synthetic fixture and integration

- [ ] 5.1 Add a synthetic test model with a below-grade street storey, a front-steps stair to the
  ground storey and a ground slab. Verify it builds, passes the model checks, renders plans and 3D
  snapshots, and round-trips through IFC.
- [ ] 5.2 Run `npm test` and `npm run typecheck`; verify both pass and all generated files are
  regenerated.

## 6. elmstead front steps (gated on the owner's measurement)

- [ ] 6.1 Record the owner's threshold-to-path drop in `models/elmstead/constraints.ts` with a note
  saying where it came from. Verify the constraint resolves. (Blocked until the measurement is
  provided.)
- [ ] 6.2 Add the street storey, front-steps stair and ground slab to `models/elmstead` using the
  measured drop and riser count. Verify `npm run check models/elmstead` and `npm run all
  models/elmstead` pass, and eye-check the steps and ground in the plans, 3D snapshots and viewer.

## Workflow follow-up

- Open the pull request titled `ELM-10: …` (draft until ready) once the number is taken, per AGENTS.md.
- Archive the change after review requirements are satisfied, syncing its delta specs into
  `openspec/specs/`.