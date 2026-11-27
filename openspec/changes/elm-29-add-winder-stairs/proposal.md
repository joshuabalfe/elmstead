# Proposal

## Why

A stair can only be a straight flight or a flight and landing today, and `docs/modelling.md` lists
winders under "Things the schema does not have yet". Many terraced houses have a stair that turns
through a fan of winder treads at one end, and the rules say not to approximate one with a straight
or half-turn stair. The first model that needs one is a terraced house (`williamson`), whose
floorplan shows a straight run of treads that ends in three winders around a newel. The model cannot
be started honestly until the schema can say that stair.

An existing type cannot express it. A flight is a rectangle with parallel nosings, and a landing is
flat. Approximating the winders with a landing would give them no treads or risers in the IFC, the
plan or the 3D view, and a pair of flights turned through 90° would put the wrong number of risers
and the wrong footprint into the stairwell.

## What Changes

- Add a third stair segment kind, `winder`: a fan of equal-angle treads inside a convex plan
  outline, turning about a newel (`pivot`). It has a riser count like a flight.
- The stair's levels, risers and top landing rule count a winder's risers with the flights'.
- A winder is the first segment of a stair and is followed by a flight. Winders after a landing, or
  at the top of a flight, are not part of this change.
- Model checks cover the winder: valid outline, pivot and entry, its place in the stair, and that
  the next flight starts on its exit edge.
- The IFC writes a winder as an `IfcStairFlight` with `PredefinedType` `WINDER`, and the `IfcStair`
  gets `QUARTER_WINDING_STAIR` when it is a winder and one flight, with the winder turning through 90°.
- The round-trip checks a winder's volume.
- The plan draws a winder with its outline, a tread line on each fan ray and a walking arrow.
- A model can use it: `stairWinder` is added to the authoring helpers.
- The docs and the `start-a-new-building-model` skill stop listing winders as unsupported.

No existing model changes: a stair with only flights and landings produces byte-identical output.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `building-schema`: a stair segment may be a winder; its shape, and how its levels and treads are derived.
- `model-checks`: unique ids include winders; a winder's outline, pivot, place in the stair and flight.
- `model-authoring`: a `stairWinder` helper beside the flight and landing helpers.
- `ifc-export`: winder as an `IfcStairFlight`, the `IfcStair` type for a winding stair, and decomposition.
- `ifc-verification`: a winder's expected volume.
- `plan-rendering`: a winder's plan symbol and query class, and its absence from the viewer's overlay.
- `ifc-viewer`: stair banding counts a winder's risers.

## Impact

- `src/shared/schema/` (`schema.ts`, `ids.ts`), `schema/building.schema.json` (regenerated).
- `src/shared/geometry/stair.ts` (levels, fan rays, treads).
- `src/backend/model/helpers.ts`, `src/backend/checks/model.ts`, `src/backend/ifc/writer.ts`
  (including a multi-solid body), `src/backend/ifc/roundtrip.ts`.
- `src/shared/render/plan.ts`; the viewer's stair riser height in `src/frontend/scene/engine.ts`.
- `tests/`: schema, ids, checks, writer, round-trip, plan snapshot, viewer; a winder in a fixture.
- `docs/modelling.md`, `docs/ifc.md`, `docs/rendering.md`, `docs/development.md`, `docs/architecture.md`
  and the `start-a-new-building-model` and `edit-an-existing-building-model` skills.
- No new dependency, no new IFC colour and no new plan colour: a winder is a stair solid like a flight.
