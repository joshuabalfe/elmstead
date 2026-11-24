# Proposal

## Why

The viewer's plan style is a drawing convention painted over the 3D model, not a render of it: room
fills drawn without depth, slab tops discarded, wall tops repainted charcoal, plan linework floating
5 mm above the walls. With one storey that reads beautifully, and it is what makes the Top view a
plan surrogate the plan-versus-3D test can check. With two it falls apart. The Top view shows the
lowest storey's fills under every storey's wall tops, so it reads like neither storey's plan; an
upper storey's slab has nothing drawn behind it once its top is discarded; and anything the upper
floor adds that the ground floor lacks becomes a test mismatch. ELM-4's two-storey fixture made all
of that visible, and ELM-4's direction-keyed slab discard is a stopgap, not an answer.

The direction is a viewer that shows the whole building honestly: storeys stacked, nearer walls and
floors blocking what is behind and beneath them, a roof when one is traced. Plan style keeps its
value where it actually works — as the plan view of one storey. Storey visibility is the primitive
both rely on, and this change gives it a face: a selector in the bar that shows every storey up to
the chosen one.

## What Changes

- Add storey visibility to the viewer. `?storeys=` takes a comma-separated list of storey ids and
  shows only those; omitting it shows every storey, as today. Hiding maps each fragment to its
  storey by the Tag the writer puts on every element — or the Name, for spaces, whose Tag is empty —
  so a hidden storey takes its openings, rooms and, once stairs exist, its flights and landings
  with it.
- Add a storey selector to the viewer bar: choosing a storey shows it and every storey below it,
  hiding everything above without moving the camera. The choice is written to `?storeys=` as the
  cumulative list, so it can be shared, while the parameter keeps its exact-subset meaning for tests
  and hand-written URLs.
- Make plan style stack. Each shown storey's floor becomes its own room fills and door swings, at
  that storey's level, writing depth: the floor you see is the topmost one, and it hides the storeys
  below instead of the grey slab showing through. Slab tops stay discarded in plan style, at every
  storey, so the fills are the floor. Exposed slab edges stay drawn, so a floor shows its structure's
  thickness; the lower storey's walls stop at the slab's underside, so the slab sits on them and its
  edge is the floor-structure band between storeys.
- Room names and areas join the dimensions on the plane at each storey's ceiling, instead of
  camera-facing billboards. A billboard stands up through the floor above it and can never be
  occluded; a plane at the ceiling is occluded exactly like the rooms it names.
- The Top view of a single shown storey is that storey's plan view, whichever storey it is, so an
  upper floor gets a plan surrogate of its own for the first time.
- Point the plan-versus-3D test at the storey it compares: each storey's plan is checked against the
  Top view of that storey alone. Two-storey models with different layouts per floor become covered
  instead of excluded.
- Walk mode stands on the lowest storey still shown.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ifc-viewer`: storey visibility, plan style scoped to one shown storey, occlusive multi-storey
  rendering, and the plan-versus-3D contract.

## Impact

- `viewer/main.ts`: visibility, the selector, plan-style scoping, walk-mode entry.
- `viewer/index.html`: the storey selector in the bar.
- `tests/plan-vs-3d.test.ts`: per-storey comparisons and the selector's picture.
- `docs/rendering.md` and `docs/modelling.md`: the viewer section, and the floor-structure
  convention the provisional Elmstead first floor now follows.
- `models/elmstead`: the provisional first floor sits one structure thickness above the ground
  ceiling, with the ground walls stopping at the ceiling so the slab sits on them; its edge is the
  structure band between storeys, and a stair's rise is ceiling plus joists. The stairwell opening
  follows the ground plan's room and wall edges.
- No dependency on any other open change. The two-storey case the tests need is synthesised in the
  test from an existing single-storey model — a cloned second storey at a higher elevation with a
  different wall layout — because the viewer test publishes JSON and IFC from an in-memory model and
  never needs a model file. ELM-4's `models/example-two-storey`, if it lands first, is welcome as an
  extra case but is not required.
- Out of scope: per-storey checkboxes for arbitrary subsets (the selector is cumulative, and
  `?storeys=` already expresses any subset), a roof, per-storey plan SVGs from `render` (already per
  storey), and sections or cut planes.
