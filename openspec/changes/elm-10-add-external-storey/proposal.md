# Proposal

## Why

elmstead has internal stairs but no front steps: the system cannot express steps climbing from the
ground outside the front door up to the threshold, because a stair only climbs between two storeys
and the model has no external ground level. Representing the external ground as a below-grade
"street" storey — a recognised BIM convention for giving external works a spatial container — lets
the front steps reuse the existing `Stair`, `Slab` and `Storey` types with no new element type, and
gives a home for future external works (paths, patios, garden walls).

## What Changes

- Establish the **external-storey pattern**: a storey whose elevation is below the building's ground
  floor (negative elevation), which MAY have no rooms and holds external works — a ground slab and a
  stair climbing to the lowest internal storey. The schema already permits this; the spec states the
  intent so models use it consistently.
- **Front steps** are a `Stair` on the street storey whose `toStoreyId` is the ground storey. No new
  element type and no change to the stair shape or its derived elevations.
- Add an optional **`material`** field to `Slab` (`"concrete"`, the default, or `"ground"`) so an
  external ground slab renders as a distinct surface rather than concrete grey. This is the only
  schema addition; existing slabs are unchanged.
- **Render the external ground**: a ground fill in the plan's floor layer, a distinct IFC display
  colour, and matching viewer presentation, so the steps read against the ground they stand on.
- Model elmstead's street storey, front steps and ground slab. The street elevation and riser count
  come from the owner's measurement of the drop from the front door threshold to the path; that
  measurement is a dependency of the model edit, not of the pipeline capability.

## Capabilities

### New Capabilities

None. The external storey reuses the existing storey, stair and slab types.

### Modified Capabilities

- `building-schema`: state that a storey MAY be external (below grade, no rooms required, holding
  external works); add the optional `Slab.material` field.
- `plan-rendering`: draw a ground slab's floor fill in a ground colour distinct from room fills.
- `ifc-export`: give ground slabs a distinct display colour in `STYLES`.
- `ifc-viewer`: present ground slabs in the ground colour in both plan style and 3D, without
  disturbing the plan-versus-3D comparison.

## Impact

- Schema: `src/schema/schema.ts` and the regenerated `schema/building.schema.json`.
- Presentation: `src/ifc/styles.ts`, `src/ifc/writer.ts`, `src/render/style.ts`, `src/render/plan.ts`,
  `viewer/main.ts` (`styleOf`).
- Model: `models/elmstead/` gains a street storey, a front-steps stair and a ground slab (needs the
  owner's drop measurement).
- Tests: schema export, plan SVG snapshot and plan-versus-3D comparison snapshots regenerate; new
  scenarios cover the external storey and ground material.
- No new dependencies and no new element type. Sloped ground (garden) and pitched roofs are out of
  scope; they are later changes that can reuse the same storey and a future sloped-surface mechanism.