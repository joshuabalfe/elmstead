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
  checks. Elmstead's own stair waits for the first-floor plan.
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
- `viewer/main.ts`, for the plan-style slab-top fix
- `src/checks/` and `src/checks/model.ts`
- Tests, docs, and a two-storey fixture
- Stairs need no viewer work: they are drawn by `renderPlan` alone, so the plan-style overlay the
  viewer composites from `renderFloor`, `renderWallTops` and `renderPlanAnnotations` is untouched,
  and the IFC geometry renders as it is. But this is the project's first two-storey model, and it
  exposed a plan-style bug: slab top faces were discarded in every view, so an upper floor was a
  hole you saw straight through. Discarding is now limited to the orthographic Top view, where the
  plan's room fills stand in for the floor. `models/elmstead/` is not changed until its first floor
  is traced.
- Out of scope: winders, curved or spiral stairs, railings, front steps, upper-floor slab openings,
  headroom and building-code checks, and the Elmstead first-floor layout.