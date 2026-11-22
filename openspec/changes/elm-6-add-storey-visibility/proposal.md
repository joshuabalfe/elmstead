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
both rely on, and the checkboxes this vision ends with are that primitive with a face on it.

## What Changes

- Add storey visibility to the viewer. `?storeys=` takes a comma-separated list of storey ids and
  shows only those; omitting it shows every storey, as today. Hiding works through the IFC spatial
  structure the writer already emits, via fragments' spatial tree and per-item visibility.
- Make plan style a single-storey mode. With exactly one storey shown it behaves as now, for that
  storey: its room fills and door swings are the floor, its wall tops go charcoal, its plan linework
  floats above them, and slab tops are discarded while looking straight down. With more than one
  storey shown the viewer renders the IFC's own colours, occlusively, keeping the white background,
  no grid and the room annotations.
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

- `viewer/main.ts`: visibility, plan-style scoping, walk-mode entry.
- `viewer/index.html`: a storey picker is deliberately not here yet; the checkboxes come later on
  this same primitive.
- `tests/plan-vs-3d.test.ts`: per-storey comparisons.
- `docs/rendering.md`: the viewer section.
- Depends on ELM-4 for a two-storey model to exercise this: `models/example-two-storey`. If ELM-4 is
  not on main when this is implemented, add a minimal two-storey model here instead.
- Out of scope: the checkbox UI, a roof, per-storey plan SVGs from `render` (already per storey), and
  sections or cut planes.
