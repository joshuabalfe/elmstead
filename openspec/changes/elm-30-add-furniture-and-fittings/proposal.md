# Proposal

## Why

A model can describe a building's shell and its circulation, but nothing inside the rooms. A room
is a 2D outline with a name, so a bedroom and a bathroom differ only in a label, and the plan, the
3D view and the IFC cannot show that one holds a bed and the other a bath. Furnishings are not
expressible with the existing types: a `Wall` or `Slab` would export as an `IfcWall` or `IfcSlab`
with the wall or slab colour and plan treatment, a `Room` has no height or contents, and a
`Railing` is a guard; the repo rule is to add a type rather than approximate one. IFC4 already
classifies this content (`IfcFurniture`, `IfcSanitaryTerminal` and their predefined types), so the
export can say what an object is, not only where it stands.

## What Changes

- Add an optional `furnishings` array to each storey and a new `Furnishing` element: a `kind` from
  a closed catalogue, a plan position `at` (the centre of its footprint), an optional `rotation`,
  an optional `elevationOffset` above the storey floor, and optional `width`, `depth` and `height`
  overriding the kind's default overall size. Nothing else is stored.
- Define the catalogue as the basic IFC4 values: the seven `IfcFurnitureTypeEnum` kinds (`bed`,
  `chair`, `desk`, `file-cabinet`, `shelf`, `sofa`, `table`) and five household
  `IfcSanitaryTerminalTypeEnum` kinds (`bath`, `shower`, `sink`, `toilet`, `wash-basin`).
- Derive each kind's shape from its overall size as a few additive, non-overlapping rectangular
  extrusions, so a chair has a seat, a back and legs and a bath has a rim around a recessed floor,
  rather than a single box.
- Export each furnishing as an `IfcFurniture` or `IfcSanitaryTerminal` contained in its storey,
  with a swept-solid body and a `FootPrint` plan outline, related to one derived
  `IfcFurnitureType` / `IfcSanitaryTerminalType` per kind used, which carries the predefined type.
- Draw each furnishing on the plan sheet as the outlines of its parts' footprints, in a queryable
  `furnishing` SVG group, in a colour the plan-versus-3D comparison skips. The viewer's plan
  overlay is unchanged.
- Give furniture and sanitary fittings their own display colours and present them in the viewer,
  hidden with their storey and included in the shown bounds.
- Add model checks: furnishing ids join the unique-id space, and a furnishing may not overlap a
  wall's body.
- Add a `furnishing()` model helper; `revise`'s `addTo` accepts a `furnishings` collection.
- Add an `example-cottage@furnished` revision that furnishes the cottage's rooms, leaving the base
  model byte-identical.
- Regenerate the schema export and update docs and tests. Models without furnishings stay
  byte-identical.

Out of scope, each a follow-up: kitchen units, wardrobes and electric appliances, round or curved
shapes, wall-relative placement helpers, mesh or imported assets, and any clearance or ergonomics
checking.

## Capabilities

### New Capabilities

- `furnishings`: the furnishing element, the closed catalogue of kinds and the IFC class and
  predefined type each maps to, default and overridden sizes, placement and rotation, and the
  contract that a kind's parts are non-overlapping and fill its overall size.

### Modified Capabilities

- `building-schema`: a storey MAY hold optional furnishings.
- `model-authoring`: a `furnishing` helper.
- `model-checks`: furnishing ids join the unique-id space; a furnishing overlapping a wall is an
  ERROR.
- `model-revisions`: a revision can furnish a storey through `addTo`.
- `model-diff`: a revision's added, removed and changed furnishings are listed, like any element.
- `ifc-export`: furnishings become typed `IfcFurniture` / `IfcSanitaryTerminal` elements with a
  body, a footprint and display colours.
- `ifc-verification`: the round-trip expects each furnishing's part volumes.
- `plan-rendering`: a furnishing symbol, plan extent and queryable SVG group.
- `ifc-viewer`: furnishings present in plan style and 3D, hide with their storey and are framed.

## Impact

- Schema: `src/shared/schema/schema.ts` and the regenerated `schema/building.schema.json`; the
  element-kind table `src/shared/schema/kinds.ts` and the `IdNode` union in `src/shared/schema/ids.ts`,
  from which the id walk, revisions, the diff and the viewer's storey ownership follow.
- New geometry: `src/shared/geometry/furnishing.ts` for each kind's default size, parts and
  footprint, shared by the writer, the round-trip, the plan and the checks.
- Pipeline: `src/backend/checks/model.ts`, `src/backend/ifc/writer.ts`, `src/backend/ifc/roundtrip.ts`,
  `src/shared/ifc/styles.ts`, `src/shared/render/style.ts`, `src/shared/render/plan.ts`,
  `src/backend/model/helpers.ts`.
- Viewer: `src/frontend/scene/engine.ts` (the shown bounds and a storey's top).
- Model: `models/examples/example-cottage/revisions/furnished.ts` (new); the base cottage and
  elmstead are unchanged.
- Tests: schema, helpers, model checks, IFC, round-trip, plan rendering, plan-versus-3D
  classification, revisions and a cottage integration; regenerate the schema and any committed
  snapshot that changes.
- Docs: `docs/modelling.md` (element table, helpers table, a furnishings section, not-modelled
  list), `docs/rendering.md` and `docs/ifc.md`.
- No new dependencies. The kinds' default sizes are written for this repo; the Bonsai furniture
  library was read as a reference only and none of its data or code is copied (see design.md).
