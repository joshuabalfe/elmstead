# Spec Delta

## ADDED Requirements

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