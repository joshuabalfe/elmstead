# Proposal

## Why

Plans are drawn with plan +y up, which is the top of whatever drawing the model was traced from.
For a model with `site.northAngle`, the top of the sheet isn't north, and the drawing gives no hint
of that beyond a small arrow. Elmstead's north angle is 135°, so its plan puts true south-east at
the top. The viewer adds to the confusion: its SW/SE/NE/NW buttons are plan directions, so **NE**
shows elmstead from true south. We want the plan to read like a site location plan, with true north
at the top.

## What Changes

- **The plan sheet is drawn true north up.** `render` turns each storey's drawing by the site's
  `northAngle`, so true north points up the sheet, and sizes the sheet to the turned drawing. The
  north arrow then always points straight up. Text stays upright, and dimension figures read along
  their lines as they do now. A model with no `northAngle` draws exactly as before.
- **The viewer's Top view is true north up as well**, so it still reads like the plan. Only the
  camera turns. The model and its plan overlays keep their plan coordinates.
- **The corner views use true directions.** `sw`, `se`, `ne` and `nw`, as buttons, `?view=` values
  and snapshot names, look from that true direction. **BREAKING** for a model with `northAngle`:
  its `?view=` links and `3d-<view>.png` snapshots show a different corner than before.
- **A project-orientation override for the comparison test.** The plan renderer and the viewer can
  still draw plan +y up on request (`?orient=project` in the viewer). The plan-versus-3D test uses
  it, because its comparison aligns on rows and columns of wall pixels and can't align walls drawn
  diagonally.
- **Spec wording says "plan x/y" where it means plan axes.** For example, room dimensions measure
  spans along plan x and plan y, not "east–west" and "north–south".

Unchanged: model coordinates and the schema, the IFC (it already records `TrueNorth`), the model
helpers' plan-axis vocabulary, the measure tool's axis snapping, and the viewer's plan overlays.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plan-rendering`: plans are drawn true north up; the north arrow points up; room dimensions are
  described along plan axes; a project-orientation option exists for comparison.
- `ifc-viewer`: the Top view is true north up; the corner views and snapshots use true directions;
  `?orient=project` keeps plan +y up; a new requirement has the plan-versus-3D comparison run in project orientation.

## Impact

- `src/render/plan.ts`: drawing rotation in the plan-to-sheet transform, sheet bounds, the room
  dimension label clearance, and the north arrow.
- `viewer/main.ts`, `viewer/view.ts`: the Top view's camera up direction, corner view directions,
  and `?orient=`.
- `tests/plan-vs-3d.test.ts`, `tests/render.test.ts` and the viewer view tests.
- `docs/rendering.md`, `docs/getting-started.md`, and `docs/modelling.md` (what `northAngle` now
  does to drawings).
- elmstead's plan PNGs and 3D snapshots change and need regenerating. The example cottage has no
  `northAngle`, so its SVG snapshot is unchanged.
