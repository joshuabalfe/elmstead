# Proposal

## Why

The ground-floor plan already reserves a half-turn stair between the hallway and the rear hall, and
the next model step is an upper floor. The schema can describe walls, openings, slabs and rooms, but
not the stairs that connect storeys: a stair has flights, risers, landings and a vertical
relationship between two storeys. Approximating it with slabs or walls would lose that relationship,
produce no stair semantics in IFC, and leave the plan without a stair symbol or meaningful checks.

## What Changes

- Add `Stair` to the schema as an optional storey element: an ordered sequence of straight flights
  and landings, with `toStoreyId` naming the storey it climbs to.
- Add `StairFlight` (`start`, `end`, `width`, `risers`) and `StairLanding` (`outline`, `thickness`)
  segment types. Elevations, riser height and going are derived from the two storeys and the
  segment sequence; the model does not store them.
- Write stairs to IFC as `IfcStair` with `IfcStairFlight` and `IfcSlab` (`LANDING`) parts,
  aggregated under the stair, with deterministic GlobalIds and a display colour.
- Draw stairs on plans: flight footprints, tread lines, landings, an up arrow and queryable SVG
  groups.
- Add model checks for the target storey (which must be the next one up), segment order, positive
  flight runs, landing outlines and flight/landing adjacency.
- Add a two-storey model fixture with a half-turn stair to exercise schema, IFC, rendering and
  checks.
- Add Elmstead's own provisional half-turn stair between its ground and first floor, using the
  stairwell the ground plan already reserves. The first floor is ELM-6's provisional one; the
  stair's dimensions derive from its provisional level and are refined when the owner's first-floor
  plan is traced.
- Keep `schemaVersion: 1`: `stairs` is optional, so existing models remain valid.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `building-schema`: storeys may contain stairs; define stair, flight and landing shapes and the
  derivation rules.
- `model-authoring`: add stair authoring helpers.
- `ifc-export`: map stairs, flights and landings to IFC4.
- `ifc-verification`: expect flight and landing volumes in the round-trip.
- `plan-rendering`: draw stair flights, treads, landings and direction arrows.
- `model-checks`: validate stair storey references, segment order and geometry.

## Impact

- `src/schema/schema.ts` and the generated `schema/building.schema.json`
- `src/model/helpers.ts`
- `src/geometry/` (stair profile and derived dimensions)
- `src/ifc/writer.ts`, `src/ifc/roundtrip.ts`, `src/ifc/styles.ts`
- `src/render/plan.ts`, `src/render/style.ts`
- `src/checks/` and `src/checks/model.ts`
- Tests, docs, a two-storey fixture, and `models/elmstead/` (its provisional stair)
- Stairs need no plan-overlay work: they are drawn by `renderPlan` alone, so the overlay the viewer
  composites from `renderFloor`, `renderWallTops` and `renderPlanAnnotations` is untouched. The viewer
  does outline the stair solids' edges, because from above the uniformly lit tread tops and edge-on
  risers otherwise read as a flat slab. This change first added an interim plan-style fix for the
  see-through upper floor the first two-storey model exposed (discard slab tops only in the Top
  view); ELM-6 superseded it with occlusive per-storey floor planes, and merging main dropped the
  interim fix, its test and its `ifc-viewer` delta. `models/elmstead/` now has ELM-6's provisional
  first floor, so this change adds its provisional stair rather than waiting for the traced plan.
- Out of scope: winders, curved or spiral stairs, railings, front steps, upper-floor slab openings,
  headroom and building-code checks, and the Elmstead first-floor layout.