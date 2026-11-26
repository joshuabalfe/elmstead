# Proposal

## Why

A half landing can only be a landing segment inside one stair, so nothing can stand on it. That
breaks down in a split-level building, where the half landings are the floors of a rear extension.
The extension's walls and windows belong at the landing's level, but they can only stand on the
main floors either side of it. elmstead needed a wall at the back of its attic stair's half landing
and a home for its half-landing window. Neither could be modelled without either a schema change
or a storey for the landing.

## What Changes

- Establish the **half-landing storey pattern**: a storey between two floors that holds a half
  landing as its slab. It MAY have no rooms. Its elevation is the lower flight's share of the
  rise. A stair climbs to it from the floor below and another climbs on from it to the floor above.
  Walls and openings that stand at the landing's level, such as a split-level extension's, belong
  to it. The schema and checks already permit this, as they did the external storey (ELM-10), so
  the spec states the intent so models use it the same way. No new element type and no schema change.
- Keep the **landing segment** for a half landing that nothing stands on. The two patterns are
  alternatives, and the docs say when to use which.
- **Narrow the plan-versus-3D comparison** to storeys whose walls span at least 2 m in both plan
  directions. The comparator aligns the two pictures on the walls' extent and only counts pixel rows
  and columns that cross a whole floor's worth of wall, so a half landing framed by a narrow
  extension, or by one wall, gives it nothing to align on. Such storeys are skipped, as pitched
  storeys already are.
- Model elmstead with it: the attic stair (8 + 8 risers, owner) and its smaller half landing, both
  half landings as storeys, the main stair split at its half landing, the split-level extension's
  walls on the half-landing storeys, and a wall at the back of the attic half landing. The
  rear-hall window is lowered to fit under the main half landing until the basement half landing
  and rear hall are planned.

## Capabilities

### New Capabilities

None. The half-landing storey reuses the existing storey, stair, slab and wall types.

### Modified Capabilities

- `building-schema`: add a "Half-landing storey" requirement, beside "External storey", stating
  that a storey MAY sit between two floors as a half landing, with no rooms, and carry the walls
  and openings at the landing's level.
- `ifc-viewer`: "Plan and 3D agree" skips storeys whose walls span less than 2 m in either plan
  direction, as well as storeys with a pitched wall.

## Impact

- `models/elmstead/`: two new storeys (`storey-main-half-landing`, `storey-attic-half-landing`),
  the attic stair, `extension.ts` for the split-level extension walls, and the ground and first
  floor's extension walls, north wall and slab bands reworked to suit. One constraint now points at
  `wall-north-extension`, the ground floor's new extension part of the north wall; its owner
  measurement is unchanged.
- `tests/elmstead.test.ts` and `tests/plan-vs-3d.test.ts`: Elmstead's stairs, storey list and
  extension walls, and the comparison's skip rule.
- `docs/modelling.md`: a section on half-landing storeys versus landing segments.
- No change to `src/`, the schema, the JSON Schema, IFC export or the viewer. The viewer's storey
  selector and keyboard stepping include the half-landing storeys like any other storey.
