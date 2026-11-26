# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
