# ifc-viewer Specification

## Purpose

A local browser viewer for the IFC files in `out/` (`viewer/`, ThatOpen components and three.js,
served by Vite). It is used interactively (`npm run view`) and headless, for the 3D snapshots and
the plan-versus-3D test.

## Requirements

### Requirement: Local, self-contained serving

The viewer SHALL serve the list of IFCs in `out/` as `/models.json`, the files in `out/`, and the
web-ifc WASM from `node_modules`, so nothing is loaded from a CDN. `ELMSTEAD_OUT_DIR` SHALL serve
another folder in place of `out/`. `npm run view` SHALL reload the page when an IFC in `out/`
changes.

#### Scenario: Rebuild while viewing

- **WHEN** `npm run build` rewrites an IFC while the viewer is open
- **THEN** the page reloads with the new model

### Requirement: Faithful IFC geometry

The viewer SHALL keep IFC coordinates unchanged (no move to the origin). It SHALL draw every item
as full geometry, never as LOD lines. In the scene Y SHALL be up and plan north SHALL be −Z.

#### Scenario: Close-up of a window

- **WHEN** the camera is close to a window with glazing bars
- **THEN** the bars and frame are drawn as solids, not lines

### Requirement: 3D snapshots

`render` SHALL save 3D snapshots of the IFC, taken in the viewer in headless Chromium. A missing
Chromium SHALL be a WARNING that still leaves the plans written; any other viewer failure SHALL be
an ERROR.

#### Scenario: Chromium missing

- **WHEN** Playwright's Chromium is not installed
- **THEN** render reports a WARNING suggesting `npm rebuild @playwright/browser-chromium`, writes the plans, closes the server and exits 0 if nothing else failed

#### Scenario: Viewer fails to load the IFC

- **WHEN** the viewer reports an error other than a missing browser
- **THEN** render reports an ERROR and exits 1 after closing the server and browser

### Requirement: Snapshot capture

`render` SHALL start the viewer on a free port and open it through Playwright with `?snapshot=1`.
For each camera it SHALL wait for `window.__elmsteadReady` and save a 1200 × 900 PNG to
`out/<name>.3d-<view>.png`. The viewer server and browser SHALL close on every success and failure
path.

#### Scenario: Snapshots written

- **WHEN** `render` runs on a model that builds
- **THEN** it writes a 1200 × 900 `out/<name>.3d-<view>.png` for each camera and leaves no viewer server or browser running

### Requirement: Snapshot cameras

The snapshot cameras SHALL be perspective `sw`, `se`, `ne` and `nw`, at the model's plan corners,
and an orthographic `top`, true north up.
Snapshots SHALL show the IFC's own colours with labels off, apart from the stair readability
presentation, which snapshots keep so the steps read there too.

#### Scenario: One snapshot per camera

- **WHEN** `render` writes a model's snapshots
- **THEN** there are five, `sw`, `se`, `ne`, `nw` and `top`, in the IFC's colours (stairs in their
  readability presentation) with no room labels or dimensions

#### Scenario: Snapshots of a turned model

- **WHEN** `render` writes the snapshots of a model whose `northAngle` is 153°
- **THEN** `3d-top.png` has true north up, and the corner snapshots show the same plan corners as before

### Requirement: Annotations from the model

When labels are on, the viewer SHALL read `out/<name>.building.json` and draw, at each storey's
ceiling (10 mm above its tallest wall):

- the plan's room and overall dimensions, lying flat;
- room names and areas as camera-facing sprites;
- a compass pointing to true north.

Labels SHALL be on by default and off in snapshots. The **Labels** button or `?labels=0|1` SHALL
toggle them.

#### Scenario: Snapshot labels

- **WHEN** the viewer is opened with `?snapshot=1`
- **THEN** no room labels or dimensions are drawn

### Requirement: Plan style

Interactively, the viewer SHALL use a plan style:

- each shown storey's room fills and door swings as its floor, at its own level, hiding the storeys below;
- wall tops and sills in the plan's charcoal, unlit;
- the plan's wall pieces, door gaps and window symbols 5 mm above the flat wall tops;
- each storey's room names, areas and dimensions on a plane at its ceiling, hidden by any storey above;
- a white background and no grid.

`?style=ifc` or `?style=plan` SHALL force a style.

#### Scenario: Top view

- **WHEN** the interactive viewer shows the top view
- **THEN** it reads like the plan drawing of the topmost shown storey without cutting the model

#### Scenario: Upper storey alone

- **WHEN** only an upper storey is shown in the top view
- **THEN** its own room fills are the floor, at its own elevation

#### Scenario: Labels of a hidden storey

- **WHEN** a storey is hidden by `?storeys=`
- **THEN** its room names, areas and dimensions are hidden with it

### Requirement: Plan and 3D agree

The test suite SHALL build each model and, for every storey whose walls are all flat-topped and
span at least 2 m in both plan directions, render the viewer's top view with only that storey shown
and compare it with that storey's plan in overlapping 500 mm tiles. Pixels are classified as wall,
room fill or paper. A tile SHALL fail above 10% mismatch, and failures SHALL be reported in metres
from the outer walls' south-west corner.

#### Scenario: Room outline on a wall centreline

- **WHEN** a room outline runs to a wall's centreline instead of its face
- **THEN** the plan-versus-3D test fails on the affected tiles

#### Scenario: Two storeys with different layouts

- **WHEN** a model's storeys have different wall layouts
- **THEN** each storey's plan is compared against the top view of that storey alone, and both pass

#### Scenario: Storey with a pitched wall

- **WHEN** a storey has a pitched (gable) wall
- **THEN** the cut-poché plan-versus-3D comparison skips that storey, because a sloped top's cut
  footprint differs from its top projection (a top-view comparison is a follow-up)

#### Scenario: Storey with walls too small to align on

- **WHEN** a storey's walls span less than 2 m in either plan direction, such as a half-landing storey framed by a 1.4 m extension or by one wall
- **THEN** the comparison skips that storey, because it aligns the two pictures on the walls' extent and those walls give it too few wall pixels per row or column to find it

### Requirement: Ground presentation

The viewer SHALL recognise a ground slab's material as ground, not as a wall or concrete slab, and
present it in the ground colour in both plan style and 3D. In plan style the ground SHALL read as a
floor fill like other slabs, and the ground colour SHALL NOT disturb the plan-versus-3D comparison.

#### Scenario: Ground in 3D

- **WHEN** the viewer shows a ground slab in 3D or `?style=ifc`
- **THEN** its top face appears in the ground colour

#### Scenario: Ground in plan style

- **WHEN** the viewer shows a ground slab in plan style
- **THEN** the ground reads as a floor fill and the plan-versus-3D comparison is unchanged

### Requirement: Custom camera

`?camera=px,py,pz,tx,ty,tz` SHALL place a perspective camera at p looking at t, in scene metres.

#### Scenario: Camera parameter

- **WHEN** the viewer is opened with a `camera` parameter
- **THEN** the view starts from that position and target

### Requirement: Static serving is confined

The viewer dev server SHALL only serve files that resolve inside the configured output directory or
the web-ifc package directory. A request that resolves outside them SHALL be rejected with 404.

#### Scenario: Path traversal

- **WHEN** a request path encodes `..` and resolves into a sibling directory
- **THEN** the server returns 404 instead of the file

### Requirement: Requested view is validated

The viewer SHALL accept only `sw`, `se`, `ne`, `nw` and `top` for `?view=`. Any other value SHALL
fall back to `top` instead of failing to render.

#### Scenario: Unknown view

- **WHEN** the viewer is opened with `?view=sideways`
- **THEN** it shows the top view

### Requirement: Viewer reloads on rebuild

The viewer dev server SHALL reload the page when an IFC in the output directory is added or
changed, so an atomic rename is noticed as well as an in-place write.

#### Scenario: Rebuilt IFC renamed into place

- **WHEN** `build` atomically renames a new IFC over the old one
- **THEN** the viewer reloads and shows the new model

### Requirement: Model names are rendered as text

The viewer SHALL treat model names from `/models.json` as text when building the model picker, so a
file name containing markup is displayed literally.

#### Scenario: Markup in a file name

- **WHEN** `out/` contains an IFC whose name contains `<b>`
- **THEN** the picker shows that text and does not create a bold element

### Requirement: Walk-mode entry

The viewer SHALL enter first-person walk mode from a Walk button or `?walk=1`. It SHALL use a
perspective camera at 1.6 m above the lowest shown storey's floor, at the shown geometry's footprint
centre, facing plan north. When the URL enters the mode without a click, the viewer SHALL show a
click-to-look prompt and request pointer lock on the next click.

#### Scenario: Walk button

- **WHEN** the user chooses Walk
- **THEN** the viewer switches to the entry pose and requests pointer lock

#### Scenario: URL entry

- **WHEN** the viewer is opened with `?walk=1`
- **THEN** it starts at the entry pose with the click-to-look prompt showing, and the first click requests pointer lock

#### Scenario: Missing building JSON

- **WHEN** no building JSON is available
- **THEN** the entry pose is 1.6 m above the IFC's lowest point at its footprint centre

#### Scenario: Lowest storey hidden

- **WHEN** the ground storey is hidden and walk mode is entered
- **THEN** the entry pose stands 1.6 m above the lowest storey still shown

### Requirement: Walk controls

In walk mode, pointer-lock mouse movement SHALL look around. W/A/S/D and the arrow keys SHALL move horizontally relative to the current heading. The camera SHALL stay at its fixed eye height, and movement SHALL NOT be blocked by walls, floors or other geometry.

#### Scenario: Mouse look

- **WHEN** the pointer is locked and the user moves the mouse
- **THEN** the view turns without moving the camera position

#### Scenario: Keyboard movement

- **WHEN** W, A, S, D or an arrow key is held
- **THEN** the camera moves in the corresponding direction at walking speed and its height stays unchanged

#### Scenario: Walking through a wall

- **WHEN** the camera moves into a wall or floor
- **THEN** it passes through and keeps its height

#### Scenario: Pointer lock refused

- **WHEN** the browser refuses the pointer-lock request
- **THEN** walk mode stays active, the click-to-look prompt remains, and keyboard movement still works

### Requirement: Leaving walk mode

Walk mode SHALL end on Escape, on pointer-lock release, when another view is chosen, or when the model changes. Ending it SHALL restore the camera projection, pose and framing that were active before entry.

#### Scenario: Escape

- **WHEN** the user presses Escape in walk mode
- **THEN** pointer lock is released and the previous view and camera pose return

#### Scenario: View change

- **WHEN** the user chooses a view or another model while walking
- **THEN** walk mode ends before the new view loads

### Requirement: Snapshots ignore walk mode

The viewer SHALL ignore walk mode in snapshots. With `?snapshot=1`, no walk prompt, input handling or camera change SHALL occur, even when `?walk=1` is present, so 3D snapshots stay deterministic.

#### Scenario: Snapshot with walk parameter

- **WHEN** the viewer is opened with `?snapshot=1&walk=1`
- **THEN** it uses the requested snapshot camera and shows no walk prompt or walk-mode input

### Requirement: Measure mode

The viewer SHALL provide a **Measure** button that toggles measure mode and `?measure=1` that starts it on at load. Measure mode SHALL start off, and snapshots SHALL ignore the parameter. Measure mode and walk mode SHALL be mutually exclusive: entering either SHALL leave the other.

#### Scenario: Measure button on

- **WHEN** the user presses **Measure**
- **THEN** measure mode turns on and the button shows it is active

#### Scenario: Measure button off

- **WHEN** the user presses **Measure** while measure mode is on
- **THEN** measure mode turns off and any pending point is cancelled

#### Scenario: URL entry

- **WHEN** the viewer is opened with `?measure=1`
- **THEN** it starts in measure mode

#### Scenario: Default

- **WHEN** the viewer is opened without `measure` in the URL
- **THEN** measure mode is off, clicks do nothing and drags navigate the view as before

#### Scenario: Snapshot

- **WHEN** the viewer is opened with `?snapshot=1&measure=1`
- **THEN** measure mode is off, no measure hint or list is shown and no clicks measure

#### Scenario: Walk and measure are exclusive

- **WHEN** the user enters walk mode while measure mode is on, or enters measure mode while walking
- **THEN** the other mode ends first

#### Scenario: Both URL parameters

- **WHEN** the viewer is opened with `?walk=1&measure=1`
- **THEN** walk mode starts and measure mode is off

#### Scenario: Model change does not re-enable the URL mode

- **WHEN** the user turns measure mode off and then selects another model
- **THEN** measure mode stays off

### Requirement: Picking and snapping

The viewer SHALL pick a measurement point only from a click or tap on model geometry that does not drag. It SHALL snap to the nearest corner or edge within snapping range, preferring a corner on an equal-distance tie, and otherwise use the exact face point. A click that arrives while a pick is being resolved SHALL become the next candidate, not be discarded.

#### Scenario: Corner snap

- **WHEN** the user clicks within snapping range of a corner
- **THEN** the measurement point is the corner, not the face point under the cursor

#### Scenario: Edge snap

- **WHEN** the user clicks within snapping range of an edge but not a corner
- **THEN** the measurement point lies on that edge

#### Scenario: Nearest snap wins

- **WHEN** a corner and an edge are both within snapping range
- **THEN** the nearer one is used, and the corner wins only when they are equally near

#### Scenario: Face fallback

- **WHEN** the user clicks away from any corner or edge
- **THEN** the measurement point is the exact point where the ray meets the face

#### Scenario: Drag adds no point

- **WHEN** the pointer moves beyond the click threshold before release
- **THEN** no measurement point is added and the drag still pans or orbits as before

#### Scenario: Off the model

- **WHEN** the user clicks where no model geometry is under the pointer
- **THEN** no measurement point is added

#### Scenario: Touch tap

- **WHEN** the user taps the model with one finger without moving
- **THEN** a measurement point is picked

#### Scenario: Click during a pick is kept

- **WHEN** the user clicks again before the first pick has resolved
- **THEN** that click becomes the next point once the first pick completes

### Requirement: Axis-aligned second point

After the first point is picked, the viewer SHALL project the second pick onto the nearest axis line through the first point (scene X, Y or Z), so the measurement has exactly one non-zero component. Ties SHALL prefer X, then Z, then Y.

#### Scenario: Plan span along X

- **WHEN** the second pick is mostly east or west of the first point
- **THEN** the measurement runs along X and its two endpoints share Y and Z

#### Scenario: Plan span along Z

- **WHEN** the second pick is mostly north or south of the first point
- **THEN** the measurement runs along Z and its two endpoints share X and Y

#### Scenario: Vertical span

- **WHEN** the second pick is mostly above or below the first point
- **THEN** the measurement runs vertically and its two endpoints share X and Z

#### Scenario: Axis tie

- **WHEN** two axes are equally far from the second pick
- **THEN** X wins over Z and Z wins over Y

### Requirement: Creating and keeping measurements

Each pair of picks SHALL create a numbered measurement and keep it in a list in pick order. A later pair SHALL add another measurement without removing earlier ones. Completed measurements SHALL stay visible after measure mode is turned off.

#### Scenario: First measurement

- **WHEN** the user picks two points in measure mode
- **THEN** one measurement appears in the list

#### Scenario: More measurements

- **WHEN** the user picks another two points
- **THEN** a second measurement is added and the first remains visible

#### Scenario: Pending point

- **WHEN** only one point has been picked
- **THEN** no measurement exists yet and the picked point is marked

#### Scenario: Mode off

- **WHEN** the user turns measure mode off
- **THEN** completed measurements remain visible

### Requirement: Measurement list

The viewer SHALL show a measurement list with one row per completed measurement, in pick order, giving its number and its straight-line, horizontal and vertical distances. The list SHALL update when measurements are added or cleared, SHALL remain visible when there are measurements even if measure mode is off, and SHALL be hidden in snapshots.

#### Scenario: List rows

- **WHEN** two measurements exist
- **THEN** the list shows M1 and M2 with all three distances for each

#### Scenario: List updates

- **WHEN** a measurement is added or Clear is pressed
- **THEN** the list gains or loses the corresponding row

#### Scenario: List with the mode off

- **WHEN** measure mode is turned off while measurements exist
- **THEN** the measurement list stays visible

#### Scenario: List in a snapshot

- **WHEN** the viewer is opened with `?snapshot=1`
- **THEN** no measurement list is shown

### Requirement: Measurement readout

Each measurement SHALL draw a solid line between its two points, a marker at each point, and a camera-facing label at the midpoint. These SHALL draw above the model and the viewer's other overlays, so a wall, floor or storey above never hides a measurement. The label SHALL state the straight-line distance, the horizontal plan distance and the vertical difference, in millimetres rounded to the nearest millimetre.

#### Scenario: Distances in three dimensions

- **WHEN** two picked points differ both horizontally and vertically
- **THEN** the label shows the straight-line, horizontal and vertical distances in millimetres

#### Scenario: Level points

- **WHEN** both picked points are at the same height
- **THEN** the vertical difference is 0 mm and the straight-line distance equals the horizontal distance

#### Scenario: Rounding

- **WHEN** a distance is not a whole number of millimetres
- **THEN** it is shown rounded to the nearest millimetre

#### Scenario: Readable in front of the model

- **WHEN** the viewer is in the Top view or a 3D view and the measurement is in front of the model
- **THEN** the line, markers and label are legible against the model, and the label faces the camera

#### Scenario: Occluded across storeys

- **WHEN** a wall, floor or storey above is between the camera and a measurement
- **THEN** the geometry hides the measurement instead of the measurement drawing through it

### Requirement: Clearing and cancelling

The viewer SHALL provide a **Clear** control that removes every measurement and any pending point, and it SHALL be available whenever either exists. Escape SHALL cancel a pending point and, when none is pending, leave measure mode. Turning measure mode off SHALL cancel a pending point but keep completed measurements.

#### Scenario: Clear with measurements

- **WHEN** the user presses **Clear** while measurements exist
- **THEN** every measurement and any pending point are removed

#### Scenario: Clear with only a pending point

- **WHEN** the user presses **Clear** after one pick
- **THEN** the pending point is removed and the list stays empty

#### Scenario: Escape with a pending point

- **WHEN** the user presses Escape with a point picked but no measurement yet
- **THEN** the pending point is removed and measure mode stays on

#### Scenario: Escape with nothing pending

- **WHEN** the user presses Escape in measure mode with no pending point
- **THEN** measure mode ends

#### Scenario: Measure mode off with a pending point

- **WHEN** the user turns measure mode off after one pick
- **THEN** the pending point is removed and completed measurements remain

### Requirement: Measurements follow their model

Changing the model SHALL remove every measurement and any pending point. Choosing another revision counts as changing the model. Entering walk mode SHALL also remove them. Changing the camera view SHALL NOT remove them.

#### Scenario: Model change

- **WHEN** the user selects another model
- **THEN** every measurement and any pending point are removed

#### Scenario: Revision change

- **WHEN** the user chooses another revision of the same model
- **THEN** every measurement and any pending point are removed

#### Scenario: Walk mode

- **WHEN** the user enters walk mode
- **THEN** every measurement and any pending point are removed

#### Scenario: View change

- **WHEN** the user chooses another camera view
- **THEN** the measurements stay and stay aligned with the model

### Requirement: Ephemeral measurements

Measurements SHALL exist only in the viewer session. They SHALL NOT be written to the building JSON, constraints JSON, JSON Schema, IFC or 3D snapshots.

#### Scenario: Generated outputs unchanged

- **WHEN** the user takes measurements in the viewer and the pipeline is built or rendered
- **THEN** no generated file or snapshot contains a measurement

### Requirement: Constraint labels

When constraints are shown, the viewer SHALL read `out/<name>.constraints.json` when present and
draw each constraint as a red camera-facing label showing its id and required distance, at the
midpoint of the span its measurement covers, on its storey, legible over the model in the Top and
3D views. A missing constraints file SHALL leave the rest of the viewer unchanged.

#### Scenario: Constraint label in the Top view

- **WHEN** the viewer shows a model with constraints and constraints are shown
- **THEN** each constraint's id and distance appear in red at the midpoint of its measured span

#### Scenario: Constraint label in a 3D view

- **WHEN** the viewer is in a corner view with constraints shown
- **THEN** the constraint labels face the camera and are drawn over the model

#### Scenario: No constraints JSON

- **WHEN** `out/<name>.constraints.json` is absent
- **THEN** the viewer shows the model and room labels with no constraint labels

### Requirement: Constraint lines

While constraints are shown, the viewer SHALL use a thick red dotted line to show the span each
measurement covers: between the two points, along x or y, or projected along the wall, at the same
height as its label. Lines SHALL be drawn over the model and SHALL follow the constraints setting.

#### Scenario: Dotted line in the Top view

- **WHEN** the viewer shows a model with constraints and constraints are shown
- **THEN** each measurement's span is drawn as a thick red dotted line

#### Scenario: Dotted line in a 3D view

- **WHEN** the viewer is in a corner view with constraints shown
- **THEN** the dotted lines remain visible over the model

### Requirement: Constraint visibility

Constraint labels and lines SHALL follow the **Constraints** button and `?constraints=0|1`,
independently of the **Labels** button and `?labels=0|1`. They SHALL be hidden by default,
interactively and in rendered snapshots, and SHALL show only when the button is pressed or
`?constraints=1` is given.

#### Scenario: Default

- **WHEN** the viewer opens with no `constraints` override
- **THEN** no constraint labels or lines are drawn

#### Scenario: Constraints toggle

- **WHEN** the user presses **Constraints**, or opens the viewer with `?constraints=1`
- **THEN** the constraint labels and lines appear

#### Scenario: Constraints off

- **WHEN** the user presses **Constraints** again, or opens the viewer with `?constraints=0`
- **THEN** no constraint labels or lines are drawn

#### Scenario: Labels toggle leaves constraints alone

- **WHEN** constraints are on and the user turns room labels off, or opens the viewer with `?labels=0`
- **THEN** the constraint labels and lines remain visible

#### Scenario: Snapshot

- **WHEN** the viewer is opened with `?snapshot=1` and no `constraints` override
- **THEN** no constraint labels or lines are drawn

### Requirement: Stair readability presentation

The viewer SHALL recolour stair solids so the steps read from above, in every mode including
snapshots and `?style=ifc`: upward faces alternate the floor cream with a darker cream, vertical
faces take the wall colour, and an edge outline reads the nosings. The recolour SHALL NOT change the
base material colour. Banding SHALL use one riser height per model, taken from the stair with the
largest riser: a model whose stairs differ in riser height SHALL band every stair on that height.

#### Scenario: Steps read from above

- **WHEN** the viewer shows a stair from the Top view, in any style or snapshot
- **THEN** alternate treads shade cream / darker cream, banded on the shared riser height, and the
  nosings read as edges

#### Scenario: Two stairs with different risers

- **WHEN** a model has two stairs with different riser heights, such as the main stair and the front
  steps
- **THEN** both band on the largest riser height, the documented shared-riser limitation

#### Scenario: Snapshots keep the readability presentation

- **WHEN** `render` writes a model's 3D snapshots
- **THEN** the stair appears in its cream readability presentation, not the base IFC colour

### Requirement: Storey visibility

`?storeys=` SHALL take a comma-separated list of storey ids and show only those storeys. Omitting it
SHALL show every storey, as today. An id that names no storey SHALL be ignored, with a note in the
status line, rather than failing to render. Hiding a storey SHALL hide everything the IFC contains
or aggregates in it, and the drawings and labels made for it.

#### Scenario: One storey of two

- **WHEN** the viewer is opened with `?storeys=storey-ground` on a two-storey model
- **THEN** only the ground storey's walls, openings, slabs, rooms and stairs are drawn, with its labels

#### Scenario: Unknown storey id

- **WHEN** `?storeys=` names an id that is not a storey of the model
- **THEN** every storey is shown and the status line names the id that was not found

#### Scenario: Omitted

- **WHEN** the URL has no `storeys` parameter
- **THEN** every storey is shown

### Requirement: Storey selector

The viewer SHALL offer a selector listing the model's storeys from lowest to highest. Choosing a
storey SHALL show that storey and every storey below it, hiding every storey above, without moving
the camera. The selection SHALL be written to `?storeys=` as the ids it shows, and the topmost
storey SHALL clear the parameter. A `?storeys=` set that is not some floor's prefix SHALL show a
disabled custom value until a floor is chosen. The selector SHALL be hidden for a single-storey
model.

#### Scenario: Choosing a floor

- **WHEN** the viewer shows a two-storey model and the user chooses the ground storey
- **THEN** only the ground storey is drawn, with its labels and floor

#### Scenario: Everything below

- **WHEN** the user chooses the topmost storey
- **THEN** every storey is drawn, the URL has no `storeys` parameter, and the camera has not moved

#### Scenario: Camera stays put

- **WHEN** the user changes the selection
- **THEN** the camera, projection and framing stay exactly as they were, and only the drawn storeys differ

#### Scenario: Shared view

- **WHEN** the viewer is opened with `?storeys=storey-ground,storey-first-floor`
- **THEN** the selector shows the first floor and both storeys are drawn

#### Scenario: Another floor chosen mid-change

- **WHEN** the user chooses a second floor before the first change has finished
- **THEN** the viewer eases from where it is to the second floor, and it ends exactly as if that floor had been chosen alone

#### Scenario: With Transparency

- **WHEN** Transparency is on and the user chooses another floor
- **THEN** the floor change is swept as usual, with the entering and leaving storeys fading to and from the see-through opacity

#### Scenario: Upper storey alone

- **WHEN** the viewer is opened with `?storeys=` naming only an upper storey
- **THEN** that storey alone is drawn and the selector shows a disabled custom value

### Requirement: Storey keyboard shortcut

Arrow Up SHALL show the next storey above the highest storey now shown, and Arrow Down SHALL hide the highest storey now shown, each with the same effect as choosing the resulting floor in the storey selector. Neither SHALL wrap: Arrow Up with the topmost storey shown, and Arrow Down with only the lowest storey shown, SHALL do nothing.

#### Scenario: Step up

- **WHEN** a two-storey model shows only its ground storey and the user presses Arrow Up
- **THEN** both storeys are drawn, the selector shows the upper storey, the URL has no `storeys` parameter, and the camera has not moved

#### Scenario: Step down

- **WHEN** every storey of a two-storey model is shown and the user presses Arrow Down
- **THEN** only the ground storey is drawn, the selector shows it, `?storeys=` names it, and the camera has not moved

#### Scenario: No wrap at the top

- **WHEN** the topmost storey is shown and the user presses Arrow Up
- **THEN** nothing changes

#### Scenario: No wrap at the bottom

- **WHEN** only the lowest storey is shown and the user presses Arrow Down
- **THEN** nothing changes

#### Scenario: Custom selection

- **WHEN** `?storeys=` shows a set no floor's prefix describes and the user presses Arrow Up or Arrow Down
- **THEN** the step starts from the highest storey shown, and the result is a floor's prefix

### Requirement: Storey shortcut scope

The storey shortcut SHALL be ignored in walk mode, where the arrows keep walking, with Ctrl, Alt, Meta or Shift held, for a single-storey model, in snapshot mode, and while a form control other than the storey selector has focus. While the storey selector has focus the shortcut SHALL still step it, and the browser's own arrow-key handling for it SHALL NOT also act. The selector's tooltip SHALL name the keys.

#### Scenario: Walk mode

- **WHEN** walk mode is active and the user presses Arrow Up or Arrow Down
- **THEN** the camera walks and the storey selection does not change

#### Scenario: Single storey

- **WHEN** the model has one storey and the user presses Arrow Up or Arrow Down
- **THEN** nothing changes

#### Scenario: Held key

- **WHEN** the user holds Arrow Down on a three-storey model
- **THEN** the selection keeps stepping down at the auto-repeat rate until the key is released or the lowest storey is shown

#### Scenario: Selector focused

- **WHEN** the user has just chosen a floor from the selector, which keeps focus, and presses Arrow Down
- **THEN** the selector steps down exactly one floor

#### Scenario: Other control focused

- **WHEN** the model selector has focus and the user presses Arrow Up
- **THEN** the storey selection does not change

#### Scenario: Modifier held

- **WHEN** the user presses Shift+Arrow Up
- **THEN** the storey selection does not change

### Requirement: Floors stack occlusively

In plan style each shown storey's floor SHALL be its own room fills and door swings, at that
storey's level, drawn so that it hides everything below it. A slab's top SHALL NOT be drawn; its
underside SHALL be the ceiling of the storey below, and its exposed edges SHALL be drawn so a floor
reads as the structure's thickness. The lower storey's walls SHALL stop at the slab's underside, so
the slab sits on them and its edge forms the floor-structure band at the facade.

#### Scenario: Whole building from a corner

- **WHEN** every storey of a two-storey model is shown in a corner view
- **THEN** the upper storey's floor and walls hide the ground floor behind and beneath them

#### Scenario: Whole building from above

- **WHEN** every storey is shown in the top view
- **THEN** the topmost storey's room fills are the floor, and no lower storey shows through them

#### Scenario: Slab edges from outside

- **WHEN** a two-storey model is shown in plan style from outside
- **THEN** the slab's exposed edge reads as the floor-structure band between storeys, with walls above and below it

#### Scenario: Exposed floor edge

- **WHEN** a storey's floor is shown in plan style around an open stairwell
- **THEN** the slab's exposed edge shows the floor structure's thickness, not a paper-thin plane

#### Scenario: Looking up from inside

- **WHEN** walk mode stands on the ground floor of a two-storey model
- **THEN** the first floor's slab underside is the ceiling, and its fills do not bleed through it

### Requirement: Ids toggle

The viewer SHALL provide an **Ids** button that toggles hover identification, and `?ids=0|1` SHALL
set it at load. Hover identification SHALL start off. Snapshots SHALL ignore the button and the
parameter.

#### Scenario: Ids button on

- **WHEN** the user presses **Ids**
- **THEN** hover identification turns on and the button shows it is active

#### Scenario: Ids button off

- **WHEN** the user presses **Ids** while hover identification is on
- **THEN** hover identification turns off and any tooltip is hidden

#### Scenario: URL entry

- **WHEN** the viewer is opened with `?ids=1`
- **THEN** hover identification starts on

#### Scenario: Default

- **WHEN** the viewer is opened without `ids` in the URL
- **THEN** hover identification is off and hovering shows no tooltip

#### Scenario: Model change does not re-enable the URL parameter

- **WHEN** the user turns hover identification off and then selects another model, with `?ids=1` in the URL
- **THEN** hover identification stays off

#### Scenario: Snapshot

- **WHEN** the viewer is opened with `?snapshot=1&ids=1`
- **THEN** no tooltip or Ids control is shown and the snapshot is unchanged

### Requirement: Hover identification

While hover identification is on, the viewer SHALL show a label at the hovered point when the
pointer is over an element's geometry, stating the element's model id, and its name when it has
one distinct from the id, in the constraint label's haloed camera-facing style, drawn above the
model and the viewer's other overlays like the measurement readout. The label SHALL follow the
pointer, name the element currently under it, and hide when the pointer is over no model
geometry.

#### Scenario: Hover a wall

- **WHEN** the pointer rests over a wall with hover identification on
- **THEN** a haloed label at the hovered point shows that wall's model id

#### Scenario: Element with a name

- **WHEN** the pointer rests over an element whose name differs from its id
- **THEN** the tooltip shows both the id and the name

#### Scenario: Off the model

- **WHEN** the pointer moves off all model geometry
- **THEN** the label hides

#### Scenario: Moving between elements

- **WHEN** the pointer moves from one element to another
- **THEN** the label updates to the element now under the pointer

#### Scenario: Model change

- **WHEN** the user selects another model while a label is showing
- **THEN** the label hides until the pointer identifies an element of the new model

#### Scenario: Drag hides the label

- **WHEN** the pointer moves with a button down while hover identification is on
- **THEN** the label hides, and returns when the pointer next rests over an element

#### Scenario: View change

- **WHEN** the user chooses another camera view while a label is showing
- **THEN** the label hides while the camera moves and names the element under the pointer again once it settles

### Requirement: Hover is passive

Hover identification SHALL NOT capture clicks or change navigation. With hover identification on,
drags SHALL pan or orbit as before, and clicks in measure mode SHALL still pick measurement
points.

#### Scenario: Drag with Ids on

- **WHEN** the user drags to pan or orbit with hover identification on
- **THEN** the view navigates as it does with hover identification off

#### Scenario: Measure with Ids on

- **WHEN** the user clicks two points in measure mode with hover identification on
- **THEN** the measurement is created as usual and the tooltip does not block the picks

### Requirement: Hover follows shown storeys

The tooltip SHALL name only elements the current storey selection shows. Hovering where a hidden
storey's elements lie SHALL identify the visible element under the pointer, or nothing.

#### Scenario: Hidden storey

- **WHEN** the storey selector hides a storey and the pointer rests where one of its walls would be
- **THEN** the tooltip names a shown element under the pointer, or no tooltip is shown

### Requirement: Hover inactive in walk mode

While walking, the viewer SHALL show no hover tooltip. Leaving walk mode SHALL restore hover
identification when it is on.

#### Scenario: Walking

- **WHEN** the user enters walk mode with hover identification on
- **THEN** no tooltip is shown while walking

#### Scenario: Leaving walk mode

- **WHEN** the user leaves walk mode with hover identification on
- **THEN** hovering the model shows tooltips again

### Requirement: Room id in room labels

When labels are on, each room's label SHALL include the room's model id alongside its name and
area, so a room can be referenced by id even though rooms have no pickable geometry.

#### Scenario: Room label shows the id

- **WHEN** the viewer shows a model with labels on
- **THEN** each room label includes the room's model id

#### Scenario: Snapshot

- **WHEN** the viewer is opened with `?snapshot=1`
- **THEN** no room labels or ids are drawn

### Requirement: Pitched wall plan overlay

The flat wall-piece overlay SHALL cover only flat-topped walls, as one plane per wall height laid
5 mm above that height's wall tops, so a taller wall's plane never floats above a shorter one. A
pitched wall's sloped top SHALL be painted charcoal by the wall-top shader's upward-face rule
instead of carrying a flat overlay.

#### Scenario: Pitched wall beside flat eaves walls

- **WHEN** a storey has a pitched gable wall alongside flat eaves walls in plan style
- **THEN** the gable's sloped top reads charcoal and the flat wall-piece overlay sits at the eaves walls' height, with no flat plane floating at the ridge

#### Scenario: Flat walls of different heights

- **WHEN** a storey has flat walls of different heights in plan style
- **THEN** each wall's poché overlay sits at its own top, with no plane floating above the shorter walls

#### Scenario: Steep pitched top beyond the upward-face rule

- **WHEN** a pitched wall's slope is steeper than the shader's upward-face threshold (about 45°)
- **THEN** its top stays lit rather than charcoal; painting steep pitched tops angle-independently is a follow-up

### Requirement: Railing presentation

The viewer SHALL recognise a railing's IFC colour as a railing and show it in that colour in 3D and
in plan style, as it shows other IFC geometry. The plan overlay SHALL NOT draw railings and SHALL
NOT change because of them. Railing pixels SHALL classify as neither wall, room nor paper in the
plan-versus-3D comparison, so the comparison skips them.

#### Scenario: Railing in 3D

- **WHEN** the viewer shows a model with railings in 3D or `?style=ifc`
- **THEN** the rail and its posts appear in the railing colour

#### Scenario: Railing in plan style

- **WHEN** the viewer shows a model with railings in plan style
- **THEN** the railing appears as IFC geometry in the railing colour and the plan overlay is unchanged

#### Scenario: Railing pixels are not compared

- **WHEN** the plan-versus-3D comparison sees the railing colour
- **THEN** it classifies as neither wall, room nor paper and is skipped

### Requirement: Railing storey visibility

A railing SHALL be hidden when its storey is hidden, like the storey's other geometry.

#### Scenario: Hiding the railing's storey

- **WHEN** the street storey is hidden with `?storeys=` or the selector
- **THEN** its railings are hidden with it

#### Scenario: Showing the railing's storey

- **WHEN** the street storey is shown again
- **THEN** its railings are shown

### Requirement: Outlying railing framing

A railing outside the walls, slabs and rooms SHALL be included in the viewer's shown bounds for 3D
views and walk entry, so it is not cropped.

#### Scenario: Outlying railing in the view

- **WHEN** a model has a railing outside its walls, slabs and rooms
- **THEN** the 3D views and walk entry include the railing in the framed bounds

### Requirement: Plan overlays as geometry

In plan style the viewer SHALL draw the floor, wall-top and annotation overlays from their drawing
primitives as scene geometry, not as raster images of the drawing. Fills SHALL be flat and unlit in
the plan's colours, and strokes and dashes SHALL be as wide and as long as on the plan at its scale
(1 px = 10 mm). Text SHALL lie flat where the plan places it, at the plan's size and rotation.

#### Scenario: Sharp at close range

- **WHEN** the camera is brought close to a window symbol or a dimension line in plan style
- **THEN** its edges stay sharp, with no texel blur or stair-stepping from a raster image

#### Scenario: Plan and 3D still agree

- **WHEN** the plan-versus-3D comparison runs after this change
- **THEN** every storey it compares passes as before

#### Scenario: Floors still stack

- **WHEN** every storey is shown in the top view
- **THEN** the topmost storey's floor fills hide the storeys below, as _Floors stack occlusively_
  requires

### Requirement: Overlay textures stay small

No texture the viewer uploads for its overlays or labels SHALL exceed 1,048,576 texels (1024 × 1024
or equivalent). The texture memory SHALL depend on the amount of text, not on a storey's footprint.

#### Scenario: Loading the Elmstead model

- **WHEN** the viewer loads the Elmstead model in plan style with labels on
- **THEN** no uploaded texture exceeds the bound

#### Scenario: A larger footprint

- **WHEN** a storey's footprint grows and its text stays the same
- **THEN** the overlays' texture memory stays about the same

### Requirement: Revisions grouped by model

The viewer SHALL treat a `/models.json` name of the form `<model>@<revision>` as a revision of
`<model>`. The model picker SHALL list each model once, without its revisions, including a model
for which only revisions have been built.

#### Scenario: Model with revisions

- **WHEN** `out/` holds `elmstead.ifc` and `elmstead@rear-extension.ifc`
- **THEN** the model picker lists `elmstead` once and does not list `elmstead@rear-extension`

#### Scenario: Only a revision built

- **WHEN** `out/` holds `elmstead@rear-extension.ifc` but no `elmstead.ifc`
- **THEN** the model picker lists `elmstead`, and choosing it shows the revision

### Requirement: Revision picker

The viewer SHALL show a revision picker beside the model picker. It SHALL list "Existing" for the
base model, then each built revision by name, and SHALL be hidden for a model with no revisions.
"Existing" SHALL be disabled when the base is not built. The choice SHALL be written to `?model=` as
`<model>@<revision>`, or `<model>` for "Existing". `?model=<model>@<revision>` SHALL open that
revision with the picker showing it. Revision names SHALL be rendered as text.

#### Scenario: Choosing a revision

- **WHEN** the viewer shows `elmstead` and the user chooses `rear-extension`
- **THEN** the revision is drawn and the URL's `model` parameter is `elmstead@rear-extension`

#### Scenario: Back to the existing building

- **WHEN** the user chooses "Existing"
- **THEN** the base model is drawn and the URL's `model` parameter is `elmstead`

#### Scenario: Shared link

- **WHEN** the viewer is opened with `?model=elmstead@rear-extension`
- **THEN** the model picker shows `elmstead`, the revision picker shows `rear-extension`, and the revision is drawn

#### Scenario: No revisions

- **WHEN** the shown model has no revisions in `out/`
- **THEN** the revision picker is hidden

#### Scenario: Base not built

- **WHEN** only revisions of the shown model have been built
- **THEN** "Existing" is listed but disabled

### Requirement: Switching revisions keeps the view

Choosing another revision of the same model SHALL load it without moving the camera or changing the
projection. This SHALL hold even when the URL has `?camera=` or `?view=`, which apply only when a
model is first opened. The shown storeys and the Ids toggle SHALL carry over. The ground grid and the
view buttons' framing SHALL follow the new revision's extent. Choosing a revision SHALL leave walk
mode, as choosing a model does. Choosing another model SHALL frame the camera as before.

#### Scenario: Camera stays put after orbiting

- **WHEN** the viewer was opened with `?view=sw`, the user then chose the top view, and then switches from "Existing" to a revision
- **THEN** the camera position, target and projection are exactly the top view's, not the south-west view's

#### Scenario: Camera parameter not re-applied

- **WHEN** the viewer was opened with `?camera=`, the user then orbited, and then switches revision
- **THEN** the camera stays where the user orbited to

#### Scenario: Storeys carry over

- **WHEN** only the ground storey is shown and the user switches revision
- **THEN** only the revision's ground storey is drawn and `?storeys=` is unchanged

#### Scenario: Larger revision

- **WHEN** a revision extends the footprint and the user then chooses a view button
- **THEN** the view frames the revision's whole extent

#### Scenario: Walk mode

- **WHEN** walk mode is active and the user chooses another revision in the picker
- **THEN** walk mode ends and the revision is drawn

#### Scenario: Another model

- **WHEN** the user chooses a different model in the model picker
- **THEN** the camera is framed on the new model as before

### Requirement: Revision switches do not flicker

While another revision loads, the previous revision SHALL stay drawn, and the new one SHALL appear
only once it is complete, with its style, storeys and overlays applied, so no blank or partly drawn
frame shows in between.

#### Scenario: No flicker

- **WHEN** the user switches revision
- **THEN** every frame drawn shows either the previous revision or the finished new one

### Requirement: Revisions stay loaded

Each revision of the shown model, Existing included, SHALL stay loaded once it has been shown. Showing
it again SHALL NOT fetch or convert its IFC again, and SHALL draw exactly as when it was first
loaded. Choosing another model SHALL release the previous model's revisions.

#### Scenario: Flicking back

- **WHEN** the user switches from Existing to a revision and back, then to the revision again
- **THEN** neither IFC is fetched a second time, and each picture matches the first time it was drawn

#### Scenario: Another model

- **WHEN** the user chooses another model and then the first model again
- **THEN** the first model's IFC and its revisions' IFCs are fetched again as they are shown

### Requirement: Revision keyboard shortcut

Arrow Right SHALL choose the next enabled entry in the revision picker, and Arrow Left the previous
one, with the same effect as choosing it. Neither SHALL wrap. The revision picker's tooltip SHALL
name the keys.

#### Scenario: Step to a revision

- **WHEN** the viewer shows "Existing" and the user presses Arrow Right
- **THEN** the first revision is drawn and the camera has not moved

#### Scenario: Step back

- **WHEN** the viewer shows the first revision and the user presses Arrow Left
- **THEN** the existing building is drawn

#### Scenario: No wrap

- **WHEN** the last revision is shown and the user presses Arrow Right
- **THEN** nothing changes

#### Scenario: Existing not built

- **WHEN** "Existing" is disabled, the first revision is shown, and the user presses Arrow Left
- **THEN** nothing changes

### Requirement: Revision shortcut scope

The revision shortcut SHALL be ignored where the storey shortcut is ignored, and for a model with no
revisions, with one difference. It SHALL work while any of the viewer's pickers has focus, and the
browser's own Arrow Left and Arrow Right handling for those pickers SHALL NOT also act.

#### Scenario: Storey selector focused

- **WHEN** the user has just chosen a floor, so the storey selector has focus, and presses Arrow Right
- **THEN** the next revision is drawn and the storey selection does not change

#### Scenario: Walk mode

- **WHEN** walk mode is active and the user presses Arrow Left or Arrow Right
- **THEN** the camera walks and the revision does not change

#### Scenario: No revisions

- **WHEN** the shown model has no revisions and the user presses Arrow Right
- **THEN** nothing changes

### Requirement: Diff mode

The viewer SHALL offer a **Diff** button, shown only while a revision is shown, that toggles Diff
mode. `?diff=1` SHALL turn it on at load, and turning it off SHALL remove the parameter. The `D` key
SHALL toggle it, ignored where the storey shortcut is ignored, or when no revision is shown.

#### Scenario: Turning Diff on

- **WHEN** the viewer shows `elmstead@rear-extension` and the user presses **Diff**
- **THEN** Diff mode turns on, the button shows it is active, and the URL has `diff=1`

#### Scenario: Existing building

- **WHEN** the viewer shows a base model
- **THEN** the **Diff** button is hidden and `D` does nothing

#### Scenario: Shared link

- **WHEN** the viewer is opened with `?model=elmstead@rear-extension&diff=1`
- **THEN** the revision is drawn in Diff mode

#### Scenario: Camera stays put

- **WHEN** Diff mode is turned on or off
- **THEN** the camera, projection and framing are exactly as they were

### Requirement: Diff colours

In Diff mode each added element SHALL be drawn in pale green (`#aceebb`) outlined in dark green
(`#1a7f37`), and each changed element in pale yellow (`#fae17d`) outlined in dark amber (`#9a6700`).
Glazing SHALL keep its transparency. Unchanged elements SHALL keep their normal colours.

#### Scenario: Added wall

- **WHEN** Diff mode is on and `wall-ext-north` is added by the revision
- **THEN** `wall-ext-north` is drawn pale green with a dark green outline along its edges

#### Scenario: Changed window

- **WHEN** Diff mode is on and a window is changed by the revision
- **THEN** the window is drawn pale yellow and see-through, with a dark amber outline

#### Scenario: Unchanged context

- **WHEN** Diff mode is on and Transparency is off
- **THEN** every unchanged element is drawn in its normal colours

#### Scenario: Diff off

- **WHEN** Diff mode is turned off
- **THEN** every element is drawn in its normal colours, with no outlines

### Requirement: Diff in the plan drawing

In Diff mode the plan-style drawing SHALL carry the diff, so it shows from above. Added and
changed walls SHALL be drawn in their status's dark colour; their window symbols and door gaps in
the pale colour with a dark outline. Added slabs and rooms SHALL be outlined in dark green and
changed ones in bright yellow (`#ffd33d`), and their floor tinted only as _Floor change in the plan
drawing_ says.

#### Scenario: Top view of an extension

- **WHEN** Diff mode is on in the top view of a revision that adds a lean-to and widens a window
- **THEN** the lean-to's walls are dark green and its floor pale green, and the window symbol is pale yellow with a dark amber outline

#### Scenario: Plan without Diff

- **WHEN** Diff mode is off
- **THEN** the plan drawing is exactly the normal plan

### Requirement: Floor change in the plan drawing

In Diff mode each storey's floor, the union of its slab and room outlines, SHALL be compared with
the base storey's. Floor only in the revision SHALL be tinted `#e6ffec` and floor only in the base
`#ffebe9`, with the door swings drawn over the tints. Floor that only changes room SHALL NOT be
tinted.

#### Scenario: Floor that only changes room

- **WHEN** Diff mode is on and the revision knocks the kitchen into `room-living`, or moves the wall between the bedroom and bathroom
- **THEN** those rooms' floors have no tint, and each reshaped room is outlined in bright yellow

#### Scenario: Room extended outwards

- **WHEN** Diff mode is on and the revision extends a room past the base's floor
- **THEN** only the new floor is tinted pale green, and floor the revision takes away is tinted pale red

### Requirement: Removed elements in the plan drawing

In Diff mode the plan-style drawing SHALL show what the revision removed, drawn from the base model
where it stood: walls, window symbols and door gaps in pale red (`#ffcecb`) with a dashed red
(`#cf222e`) outline, above the revision's own wall tops, so a bricked-up window shows over the wall
that now runs through it.

#### Scenario: Demolished wall from above

- **WHEN** Diff mode is on in the top view and the revision removes `wall-rear-kitchen`
- **THEN** that wall's outline is drawn pale red, dashed in red, where it stood

#### Scenario: Bricked-up window

- **WHEN** the revision removes a window from a wall it keeps
- **THEN** the window symbol is drawn in red over the wall

### Requirement: Removed elements as ghosts

In Diff mode the viewer SHALL load the base model's IFC alongside the revision. It SHALL draw only
the removed elements from it, in pale red (`#ffcecb`) and see-through, outlined in red (`#cf222e`).
If the base IFC is not in `out/`, Diff mode SHALL still colour added and changed elements, and the
status line SHALL say that removed elements need the base built.

#### Scenario: Demolished wall

- **WHEN** Diff mode is on and the revision removes `wall-rear-kitchen`
- **THEN** that wall is drawn pale red, see-through and outlined in red where it stood in the base model

#### Scenario: Only removed elements

- **WHEN** Diff mode is on
- **THEN** no element of the base model is drawn except the removed ones

#### Scenario: Base not built

- **WHEN** Diff mode is turned on and the base model's IFC is not in `out/`
- **THEN** added and changed elements are coloured, no ghosts are drawn, and the status line says to build the base model

#### Scenario: Existing after a Diff session

- **WHEN** the user turns Diff mode on for a revision, then switches to "Existing"
- **THEN** the existing building is drawn exactly as it was before Diff mode was used, with no ghost colours and no elements hidden

#### Scenario: Base loaded once

- **WHEN** "Existing" has already been shown, and the user then turns Diff mode on for a revision
- **THEN** the base model's IFC is not fetched again

### Requirement: Transparency

The viewer SHALL offer a **Transparency** button, for any model, that draws elements see-through.
In Diff mode it SHALL fade only the unchanged elements, so the changes stay solid. In plan style it
SHALL fade the plan drawing too, so it shows in the top view. `?xray=1` SHALL turn it on at load.

#### Scenario: Existing building

- **WHEN** the viewer shows a base model and the user presses **Transparency**
- **THEN** every element is drawn see-through, and the URL has `xray=1`

#### Scenario: With Diff

- **WHEN** Diff mode and Transparency are both on
- **THEN** added and changed elements are drawn solid in their diff colours, and every other element is see-through

#### Scenario: Top view

- **WHEN** Transparency is turned on in the top view in plan style
- **THEN** the plan drawing is drawn faded, and the picture changes

#### Scenario: Kept across switches

- **WHEN** Transparency is on and the user switches revision or chooses Existing
- **THEN** the newly shown model is drawn see-through too

### Requirement: Shown models start clean

A model the viewer shows SHALL be drawn exactly as its current Diff and Transparency settings
require, whatever it showed before. A revision kept loaded from an earlier Diff or Transparency
session SHALL NOT keep that session's colours, fading or outlines once they are turned off.

#### Scenario: Diff turned off, then back to a revision

- **WHEN** the user views a revision in Diff mode, turns Diff off, switches to another revision and back
- **THEN** the first revision is drawn in its normal colours, with no outlines

### Requirement: View changes land complete

Turning Diff mode or Transparency on or off SHALL crossfade from the previous finished picture to the
finished new one over about 60 ms, or replace it in one frame when the user prefers reduced motion.
Switching revision with either on SHALL keep the previous picture drawn until the new one is
complete. No frame SHALL show a half-applied picture.

#### Scenario: Toggling Diff

- **WHEN** the user turns Diff mode on
- **THEN** the picture changes from the previous finished picture to the finished Diff picture, through a crossfade of those two pictures

#### Scenario: Toggling Transparency

- **WHEN** the user turns Transparency on
- **THEN** the picture changes from the previous finished picture to the finished see-through picture, through a crossfade of those two pictures

#### Scenario: Reduced motion

- **WHEN** the user prefers reduced motion and turns Diff mode or Transparency on or off
- **THEN** the new picture replaces the old in one frame, with no crossfade

#### Scenario: Switching with Diff on

- **WHEN** Diff mode is on and the user switches to another revision
- **THEN** every frame drawn shows either the previous revision's Diff picture or the finished new one

### Requirement: Changes panel

In Diff mode the viewer SHALL show a panel with the count of added, changed and removed elements.
Each category SHALL have a checkbox; unchecking it SHALL draw that category as unchanged, or hide
the ghosts and plan outlines for removed. Below, the panel SHALL list every change by storey, with
its status and id. Clicking one SHALL frame the camera on that element.

#### Scenario: Counts

- **WHEN** Diff mode is on for a revision that adds 7 elements, changes 3 and removes 2
- **THEN** the panel shows 7 added, 3 changed and 2 removed

#### Scenario: Hide a category

- **WHEN** the user unchecks "removed"
- **THEN** the red ghosts and red plan outlines are hidden, and added and changed elements keep their colours

#### Scenario: Fly to a change

- **WHEN** the user clicks `wall-ext-north` in the list
- **THEN** the camera frames that wall, looking in the direction it was

#### Scenario: Panel hidden

- **WHEN** Diff mode is off
- **THEN** the panel is not shown

### Requirement: Diff follows the view

Diff colours, ghosts, the plan drawing and the panel's list SHALL follow storey visibility. Diff
mode SHALL stay on when switching between revisions of the same model, and SHALL be inactive while
"Existing" is shown, returning when a revision is chosen again.

#### Scenario: One storey shown

- **WHEN** Diff mode is on and only the ground storey is shown
- **THEN** only the ground storey's elements, ghosts and plan changes are drawn, and the list shows only ground-storey changes

#### Scenario: Switching revision

- **WHEN** Diff mode is on and the user switches to another revision
- **THEN** that revision is drawn in Diff mode against the base, and the camera has not moved

#### Scenario: Flicking to Existing

- **WHEN** Diff mode is on and the user switches to "Existing" and back
- **THEN** the base is drawn in normal colours, and the revision is drawn in Diff mode again

### Requirement: Hover shows diff status

In Diff mode, the hover label SHALL add the element's status to its id when the element is added,
changed or removed, for example `wall-ext-north · added`. A ghost SHALL be identified as its
removed base element.

#### Scenario: Hover an added wall

- **WHEN** hover identification and Diff mode are on and the pointer rests over an added wall
- **THEN** the label reads the wall's id followed by `· added`

#### Scenario: Hover a ghost

- **WHEN** the pointer rests over a removed wall's ghost
- **THEN** the label reads that wall's id followed by `· removed`

### Requirement: Diff snapshots

`render` on a revision SHALL also save a Diff-mode snapshot for each snapshot camera, to
`out/<name>.3d-diff-<view>.png`, with no changes panel. Snapshots of a base model SHALL be unchanged.
If the base IFC is missing, `render` SHALL write the Diff snapshots without ghosts and report a
WARNING.

#### Scenario: Revision render

- **WHEN** `render` runs on a built revision whose base is built
- **THEN** it writes the five normal snapshots and five `<name>.3d-diff-<view>.png` snapshots with ghosts

#### Scenario: Base render

- **WHEN** `render` runs on a base model
- **THEN** no Diff snapshots are written

#### Scenario: Base missing

- **WHEN** `render` runs on a revision whose base IFC is not in `out/`
- **THEN** the Diff snapshots are written without ghosts and a WARNING says to build the base model

### Requirement: Top view is true north up

The Top view SHALL turn its camera so true north, from the model's `northAngle`, points up the
screen, matching the plan sheet. Only the camera SHALL turn: the model, its plan overlays and its
measurements keep their plan coordinates. Flat labels SHALL still read left to right, and the
compass SHALL point straight up. A model with no `northAngle` SHALL look as before.

#### Scenario: Top view of a turned model

- **WHEN** the viewer shows the Top view of a model whose `northAngle` is 135°
- **THEN** plan +y points down and to the right on screen, room labels read left to right, and the compass points straight up

#### Scenario: Top view without a north angle

- **WHEN** the viewer shows the Top view of a model with no `northAngle`
- **THEN** plan +y points up the screen, as before

### Requirement: Corner buttons name their true direction

The `sw`, `se`, `ne` and `nw` views SHALL keep looking at the model's plan corners. Each corner
button SHALL be labelled with the nearest of the eight compass points to its true viewing direction,
from the model's `northAngle`, with ties going clockwise. `?view=` values and snapshot names SHALL
keep the plan-corner ids. A model with no `northAngle` SHALL keep the labels SW, SE, NE and NW.

#### Scenario: Corner buttons of a turned model

- **WHEN** the viewer loads a model whose `northAngle` is 153°
- **THEN** the `sw`, `se`, `ne` and `nw` buttons read N, W, S and E, and each view looks from the same plan corner as before

#### Scenario: Corner buttons without a north angle

- **WHEN** the viewer loads a model with no `northAngle`
- **THEN** the corner buttons read SW, SE, NE and NW

#### Scenario: Links keep their meaning

- **WHEN** the viewer is opened with `?view=ne` on a turned model
- **THEN** it shows the same plan corner as before this change, under the button labelled with its true direction

### Requirement: Project orientation override

`?orient=project` SHALL make the viewer ignore `northAngle` when it orients its views. The Top view
SHALL keep plan +y up and the corner buttons SHALL keep their plan-corner labels. The compass SHALL
still point to true north. Any other value, or none, SHALL mean true north orientation.

#### Scenario: Project-oriented Top view

- **WHEN** the viewer is opened with `?view=top&orient=project` on a model whose `northAngle` is 135°
- **THEN** plan +y points up the screen and the compass points 135° counter-clockwise from up

#### Scenario: Unknown orientation

- **WHEN** the viewer is opened with `?orient=sideways`
- **THEN** it orients its views to true north

### Requirement: Comparison in project orientation

The plan-versus-3D comparison SHALL draw both the plan and the viewer's top view in project
orientation, plan +y up, so walls align with pixel rows and columns whatever the model's
`northAngle`.

#### Scenario: Model with a north angle

- **WHEN** a model's `northAngle` is 135°
- **THEN** the comparison draws the plan and the top view in project orientation, and passes on the same storeys as it would with no north angle
