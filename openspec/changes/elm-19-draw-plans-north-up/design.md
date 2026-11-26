# Design

## Context

All plan drawing goes through one transform, `View.toPx` in `src/render/plan.ts`. It maps plan mm,
with y north, to sheet px, with y down. `makeView` takes the drawing's extent from the plan-axis
bounds of walls, slabs, rooms, stairs and railings. The same `View` also builds the viewer's plan
overlays (`renderPlanAnnotations`, `renderWallTops`, `renderFloor`). Those are laid in the 3D scene
as textures over a plan-mm rectangle (`Overlay.bounds`), so they must stay in plan axes.

`dimension()` already handles lines at any angle and keeps its figure upright. `northArrow()`
already turns by `northAngle`. `roomDimensions()` converts the label's px box back to mm through
two corners of `toMm`, which only works while the transform has no rotation.

In the viewer, `cameraForView` (`viewer/view.ts`) gives fixed plan-axis directions for the corner
views and looks straight down for Top. Flat labels follow the camera through `labelHeading`, and
`updateCompass` projects true north onto the screen, so both already cope with any camera yaw.

## Goals / Non-Goals

**Goals:**
- `render`'s plan files and the viewer's Top view and corner views follow true north.
- A model without `northAngle` produces identical output.

**Non-Goals:**
- Changing model coordinates, the schema, IFC placement or the plan-axis helper vocabulary.
- Turning the viewer's overlays or measure-tool axes. These follow the model's walls, which are
  along plan axes.
- Rotations in fixed 90° steps or a "front at the bottom" option. Either can come later on the same
  transform.

## Decisions

**Turn the drawing in `View.toPx`, not with an SVG `transform` on a group.** Every node is already
positioned through `toPx`, so a rotation inside it turns geometry, dimension lines and label
positions together. Text is then placed upright at the turned point. An SVG group transform would
turn the text as well, and would make `data-id` geometry differ from what tests read back.
`makeView` takes `orientation: "north" | "project"`, and `renderPlan` defaults to `"north"`.
`overlay()` always passes `"project"`, because the viewer turns its camera instead.

**The sheet extent is the bounds of the turned points.** `makeView` turns the same point set before
taking its bounds, and `toMm` inverts the rotation. Overall dimensions keep measuring the plan-axis
extent, the building's width and depth, drawn along the turned extent's sides. `dimension()` already
draws at any angle. The margins already leave room for dimensions outside the drawing.

**Room-dimension label clearance uses all four corners.** `roomDimensions` maps all four corners of
the label's px box to mm and takes their bounds. That gives a slightly larger clearance on a turned
plan, which is safe, and it matches today's result exactly when there is no turn.

**The north arrow takes the sheet's own angle.** It is drawn with `northAngle` minus the sheet's
turn, which is 0 on a true-north-up sheet and `northAngle` in project orientation.

**The viewer turns the camera.** For Top, the viewer sets the camera's up vector to true north in
scene axes, before `setLookAt`. Plan north (−sin a, cos a) maps to scene (−sin a, 0, −cos a), as
`updateCompass` already computes. For the corner views, `cameraForView` takes the north angle and
turns its plan-axis direction by it, so `ne` looks from true north-east. `?orient=project` passes 0.
These stay pure functions in `viewer/view.ts`, so the existing unit tests can cover them.

**The comparison runs in project orientation.** The plan-versus-3D comparator aligns the two
pictures on rows and columns that cross a floor's worth of wall. Diagonal walls break that, so the
test renders the plan with `orientation: "project"` and opens the viewer with `orient=project`. That
keeps the check exactly as strong as it is today.

Alternatives considered:
- Rotating model coordinates to true north. This would make every wall diagonal in the model, and
  break the axis-aligned helpers, constraints and checks.
- An SVG `<g transform="rotate">` around the plan. It would turn the text and break the upright
  label and dimension figures.
- Turning only the plan files and leaving the viewer in plan axes. The viewer's Plan style
  requirement says its Top view reads like the plan, so they would disagree.

## Risks / Trade-offs

- [Wasted sheet space at 45°-ish angles] → Accepted. At 135° elmstead's sheet is about 40% larger
  in area. The scale stays 1 px = 10 mm.
- [Room labels crowd small turned rooms] → The labels' positions don't change (they sit at the
  room's centroid). Only the room's outline turns under them. Check elmstead's plan PNGs by eye
  when they're regenerated.
- [Existing `?view=` links and 3D PNGs change meaning for turned models] → Called out as BREAKING in
  the proposal. Only elmstead sets `northAngle` today.
- [The comparison no longer checks the turned drawing] → `tests/render.test.ts` gains turned-plan
  tests: a wall's px footprint matches its turned mm footprint, the north arrow points up, and every
  element stays inside the sheet. The turn is a single transform, so the comparison in project
  orientation still covers everything else.
