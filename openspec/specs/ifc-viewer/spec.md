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
The snapshot cameras SHALL be perspective `sw`, `se`, `ne` and `nw`, and an orthographic `top`.
Snapshots SHALL show the IFC's own colours with labels off.

#### Scenario: One snapshot per camera
- **WHEN** `render` writes a model's snapshots
- **THEN** there are five, `sw`, `se`, `ne`, `nw` and `top`, in the IFC's colours with no room labels or dimensions

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
- the plan's room fills and door swings drawn under the model as the floor;
- wall tops and sills in the plan's charcoal, unlit;
- the plan's wall pieces, door gaps and window symbols 5 mm above the wall tops;
- a white background and no grid.

`?style=ifc` or `?style=plan` SHALL force a style.

#### Scenario: Top view
- **WHEN** the interactive viewer shows the top view
- **THEN** it reads like the plan drawing without cutting the model

### Requirement: Plan and 3D agree
The test suite SHALL build each model, render the viewer's top view, and compare it with the plan
in overlapping 500 mm tiles. Pixels are classified as wall, room fill or paper. A tile SHALL fail
above 10% mismatch, and failures SHALL be reported in metres from the outer walls' south-west
corner.

#### Scenario: Room outline on a wall centreline
- **WHEN** a room outline runs to a wall's centreline instead of its face
- **THEN** the plan-versus-3D test fails on the affected tiles

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
The viewer SHALL enter first-person walk mode from a Walk button or `?walk=1`. It SHALL use a perspective camera at 1.6 m above the lowest storey's floor, at the model's footprint centre, facing plan north. When the URL enters the mode without a click, the viewer SHALL show a click-to-look prompt and request pointer lock on the next click.

#### Scenario: Walk button
- **WHEN** the user chooses Walk
- **THEN** the viewer switches to the entry pose and requests pointer lock

#### Scenario: URL entry
- **WHEN** the viewer is opened with `?walk=1`
- **THEN** it starts at the entry pose with the click-to-look prompt showing, and the first click requests pointer lock

#### Scenario: Missing building JSON
- **WHEN** no building JSON is available
- **THEN** the entry pose is 1.6 m above the IFC's lowest point at its footprint centre

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
Each measurement SHALL draw a solid line between its two points, a marker at each point, and a camera-facing label at the midpoint. These SHALL be depth-tested, so they read over the model when in front of it and are hidden when a wall, floor or storey above is in front. The label SHALL state the straight-line distance, the horizontal plan distance and the vertical difference, in millimetres rounded to the nearest millimetre.

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
Changing the model SHALL remove every measurement and any pending point. Entering walk mode SHALL also remove them. Changing the camera view SHALL NOT remove them.

#### Scenario: Model change
- **WHEN** the user selects another model
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
