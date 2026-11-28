# Tasks

## 1. Schema, element-kind table and derived geometry

- [x] 1.1 Add `FURNISHING_KINDS` (`bed`, `chair`, `desk`, `file-cabinet`, `shelf`, `sofa`, `table`,
      `bath`, `shower`, `sink`, `toilet`, `wash-basin`), `FurnishingSchema` (id, optional name, `kind`,
      `at`, optional `rotation` as `Deg`, optional non-negative `elevationOffset`, optional positive
      `width`/`depth`/`height`) and `furnishings: z.array(FurnishingSchema).optional()` on `StoreySchema`
      in `src/shared/schema/schema.ts`, with the `Furnishing` and `FurnishingKind` types. Add schema tests for a
      minimal furnishing, every kind, an unknown kind, zero size, negative elevation offset and an unknown
      field. Run `npm run schema` and verify the stale-schema test and every existing model still pass.
- [x] 1.2 Add the `furnishings` entry to `STOREY_KINDS` in `src/shared/schema/kinds.ts` (schema
      `FurnishingSchema`, kind `"furnishing"`) and the `furnishing` member of the `IdNode` union in
      `src/shared/schema/ids.ts`, so the id walk, `revise`, the diff and the viewer's storey ownership take it
      from the table. Add tests that `idNodes` yields furnishings after railings, `addTo` furnishes a
      storey, `replace` and `remove` work by id, a furnishing cannot be replaced by a railing, and a
      constraint that names a furnishing id fails with "is a furnishing, not a wall". Verify
      `npm run typecheck` and `npx vitest run tests/ids.test.ts tests/revise.test.ts tests/constraints.test.ts`
      pass.
- [x] 1.3 Add `src/shared/geometry/furnishing.ts`: a table typed `Record<FurnishingKind, ...>` giving each
      kind's default size and a function from an overall size to its parts (local-frame boxes, with
      thicknesses `min(fixed, fraction of the dimension)`), the effective size, the rotated footprint of
      each part and of the whole, and the part volumes. Add `tests/furnishing.test.ts` checking, for every kind at its default
      size and at a very small size, that parts have positive dimensions, do not overlap, and have a combined
      extent equal to the overall size; that a chair has seat, back and legs and a bath has no part
      filling its recess; and that rotation moves footprints but not volumes. Verify
      `npx vitest run tests/furnishing.test.ts` passes.
- [x] 1.4 Document the element in `docs/modelling.md`: add `Furnishing` to the element table with the
      catalogue and default sizes, a "Furnishings" section with the plan-coordinate placement and rotation
      conventions and an example, and remove furnishings from the "Things the schema does not have yet"
      list. Verify the example type-checks against the schema.

## 2. Model helper and checks

- [x] 2.1 Add `furnishing(id, kind, at, { name?, rotation?, elevationOffset?, width?, depth?, height? })`
      to `src/backend/model/helpers.ts`, recording options as given and omitting the rest, and export it from
      `src/backend/model/index.ts`. Add tests for the minimal call, overrides and that an unknown kind fails
      `npm run typecheck`. Add the helper to the helpers table in `docs/modelling.md` and `furnishings` among
      the `addTo` collections. Verify `npx vitest run tests/helpers.test.ts` and `npm run typecheck` pass.
- [x] 2.2 In `src/backend/checks/model.ts` add `checkFurnishings`: an ERROR against a furnishing whose
      rotated footprint overlaps a wall's body on its storey, naming the wall, with touching allowed (extend
      `src/shared/geometry/polygon.ts` only if it has no interior-overlap test). Add fixture tests for a
      duplicate furnishing id, a furnishing sharing a room's id, a bed through a wall, a basin against a wall
      face, a rotated sofa with a corner in a wall and an overlap with a wall on another storey. Verify
      `npx vitest run tests/checks.test.ts` passes.
- [x] 2.3 Add diff tests that a revision's added, removed and changed furnishings are listed with kind
      `furnishing` and their storey, and that a furnishing moved to another storey is changed. Verify
      `npx vitest run tests/diff.test.ts` passes without touching `src/shared/diff/index.ts`; if it does not,
      fix the table entry, not the diff.

## 3. IFC export and verification

- [x] 3.1 Add `furniture` and `sanitary` entries to `STYLES` in `src/shared/ifc/styles.ts`, each at least
      0.02 in RGB distance from every other entry and from each other. Extend the style-distinctness test;
      verify `npx vitest run tests/ifc.test.ts` passes.
- [x] 3.2 Write each furnishing in `src/backend/ifc/writer.ts` as an `IfcFurniture` or
      `IfcSanitaryTerminal` contained in its storey (`Tag` = id, `Name` = name or id, GlobalId from
      `ifcGuid(id)`, `PredefinedType` the kind's value), placed at `at` with the rotation as the placement's x direction and its base at
      storey elevation plus `elevationOffset`, with a `Body` `SweptSolid` of one extruded rectangle per part
      in the kind's colour and a `FootPrint` / `Curve2D` representation of the overall outline. Add IFC
      tests for both classes, tag/name, one solid per part, the rotation axis and base height, the footprint,
      and that an unfurnished model has no furnishing entities. Verify they pass.
- [x] 3.3 Write one `IfcFurnitureType` or `IfcSanitaryTerminalType` per kind used, with the kind's
      predefined type, declared by the project and related with `IfcRelDefinesByType`, with GlobalIds
      derived from the kind. Add IFC tests for one type per kind with all instances related, no type for an
      unused kind, `toilet` giving `TOILETPAN`, stable GlobalIds across two builds, and no
      `USERDEFINED`/`NOTDEFINED` predefined type. Verify they pass.
- [x] 3.4 Add each furnishing's part volumes to `expectedVolumes` in `src/backend/ifc/roundtrip.ts` using
      the shared geometry functions. Add round-trip tests for a chair at rotation 0 and 37, a hollow bath, an
      overridden bed width and a furnishing with an `elevationOffset`. Verify
      `npx vitest run tests/roundtrip.test.ts tests/ifc.test.ts` passes.
- [x] 3.5 Build a fixture with every kind through the IfcOpenShell validator (`npm test` includes
      `tests/validate.test.ts`) and confirm it reports no errors. If the validator rejects the `FootPrint`
      representation, drop it from the writer, update `specs/ifc-export` in this change to match, and note
      it in design.md. Verify the validator test passes.
- [x] 3.6 Document the IFC mapping in `docs/ifc.md`: the class and predefined type per kind, the body
      and footprint, the derived types and the colours. Build `models/examples/example-cottage` before and
      after the change and diff the IFC and JSON bytes to confirm a model without furnishings is
      byte-identical.

## 4. Plan rendering and viewer presentation

- [ ] 4.1 Add furniture and sanitary entries to the plan palette `C` in `src/shared/render/style.ts`
      matching the IFC colours. Draw each furnishing in `src/shared/render/plan.ts` as the outlines of its
      part footprints (leaving out parts wholly inside a higher part) in a `furnishing` group with its
      `data-id`, placed with `view.toPx`, after walls and openings and before railings and stairs, and its id
      with `--ids`. Give `makeView` a furnishings option, beside `railings`, so `renderPlan` includes
      footprints in its extent while `renderFloor`, `renderWallTops` and `renderPlanAnnotations` keep their
      extent and draw none. Add plan tests for a table (tabletop only), a chair (seat and back, no legs), a
      bath (rim and recess), a rotated sofa with `orientation: "project"` and again with a non-zero
      `northAngle`, layer order, an outlying furnishing (plan extent grows, overlay bounds do not), no group
      on an unfurnished storey, and the id label with and without the flag. Verify
      `npx vitest run tests/render.test.ts` passes.
- [ ] 4.2 Add a plan-versus-3D unit check that each furnishing plan colour is ignored by
      `isIgnoredColour` (`tests/support/plan-vs-3d.ts`) and classifies as neither wall, room nor paper,
      keeping fixture furnishings clear of walls, and confirm the comparison is unchanged for models
      without furnishings. Verify `npx vitest run tests/plan-vs-3d.test.ts -t "ignores"` passes.
- [ ] 4.3 Viewer, in `src/frontend/scene/engine.ts`: add furnishing points to `computeShownBox` and the
      height of a furnishing to `storeyTop`. Storey visibility, hover labels and the Diff ghosts come from
      the table and the `Tag`, so add no code for them. Add a browser test in
      `tests/viewer-presentation.test.ts` that shows the furniture and sanitary colours in 3D and plan
      style, hides furnishings with their storey, frames an outlying furnishing, labels a picked part with
      the furnishing's id, and shows a revision's added furnishing in Diff mode; verify the new tests pass
      and the plan overlay is unchanged.
- [ ] 4.4 Document the plan symbol, drawing order, `furnishing` class and colours in
      `docs/rendering.md`. Verify the documented drawing order matches `src/shared/render/plan.ts`.

## 5. Furnished cottage

- [x] 5.1 Add `models/examples/example-cottage/revisions/furnished.ts`, a `revise` of the base using
      `addTo` and `furnishing()`, with positions derived from the base's wall faces and room outlines so
      they follow wall thickness, covering all twelve kinds and a rotated item. Verify
      `npm run check models/examples/example-cottage/revisions/furnished.ts` and `npm run all` on it pass.
- [ ] 5.2 Add cottage integration assertions: the furnished plan has a `furnishing` group per item,
      the IFC round-trips and validates, the base cottage's output is unchanged, and hiding a storey hides
      its furnishings. Verify `npm test` passes.
- [ ] 5.3 Eye-check the furnished plan, a 3D view and close-ups of a chair, a bed, a bath and a
      toilet in the viewer (`npm run view`, with the `inspect-the-rendered-output` skill): each reads as
      its kind from above and in 3D, nothing passes through a wall, hiding a storey hides its items, the
      Diff view shows the added furnishings, and the furniture and sanitary colours differ. Run the viewer
      benchmark on the furnished cottage and note any load-time change. Regenerate and review any
      committed snapshot that changed.

## 6. Integration

- [ ] 6.1 Run `npm test`, `npm run typecheck` and `npm run format`; regenerate
      `schema/building.schema.json` and any snapshot that changed, review the diffs, and run
      `npx openspec validate --all` and `npx openspec validate elm-30-add-furniture-and-fittings --strict`.
      Verify all pass.

## Workflow follow-up

- Open a draft pull request titled `ELM-30: Add furniture and fittings` from a branch named
  `elm-30-add-furniture-and-fittings` as soon as the plan is shared, so the number is taken.
- Archive the change after review and merge, syncing its deltas into `openspec/specs/`.
