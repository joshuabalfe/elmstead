# Proposal

## Why

Plans are drawn with plan +y up, which is the top of whatever drawing the model was traced from.
For a model with `site.northAngle`, the top of the sheet isn't north, and the drawing gives no hint
of that beyond a small arrow. Elmstead's north angle is about 153° (ELM-18), so its plan puts true
south-south-east at the top. The viewer adds to the confusion: its SW/SE/NE/NW buttons name plan
directions, so **NE** shows elmstead from true south. We want the plan to read like a site location plan, with true north
at the top.

## What Changes

- **The plan sheet is drawn true north up.** `render` turns each storey's drawing by the site's
  `northAngle`, so true north points up the sheet, and sizes the sheet to the turned drawing. The
  north arrow then always points straight up. Text stays upright, and dimension figures read along
  their lines as they do now. A model with no `northAngle` draws exactly as before.
- **The viewer's Top view is true north up as well**, so it still reads like the plan. Only the
  camera turns. The model and its plan overlays keep their plan coordinates.
- **The corner view buttons say where they look from.** The four corner cameras keep looking at the
  building's corners, along the plan diagonals, because that is what makes them useful 3D views.
  Each button is labelled with the nearest of the eight compass points to its true viewing
  direction. For elmstead at 153°, `sw`, `se`, `ne` and `nw` read N, W, S and E. The `?view=` values and
  `3d-<view>.png` names keep their plan-corner ids, so existing links and files keep meaning what
  they did. Only `3d-top.png` changes, because it turns to true north up.
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
- `ifc-viewer`: the Top view and its snapshot are true north up; the corner buttons are labelled
  with the true direction they look from;
  `?orient=project` keeps plan +y up; a new requirement has the plan-versus-3D comparison run in project orientation.

## Impact

- `src/render/plan.ts`: drawing rotation in the plan-to-sheet transform, sheet bounds, the room
  dimension label clearance, and the north arrow.
- `viewer/main.ts`, `viewer/view.ts`: the Top view's camera direction, the corner buttons' labels,
  and `?orient=`.
- `tests/plan-vs-3d.test.ts`, `tests/render.test.ts` and the viewer view tests.
- `docs/rendering.md`, `docs/getting-started.md`, and `docs/modelling.md` (what `northAngle` now
  does to drawings).
- elmstead's plan PNGs and `3d-top.png` change and need regenerating; its corner snapshots don't. The example cottage has no
  `northAngle`, so its SVG snapshot is unchanged.
