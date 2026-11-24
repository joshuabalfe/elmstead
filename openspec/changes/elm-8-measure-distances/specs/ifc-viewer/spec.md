# Spec Delta

## ADDED Requirements

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