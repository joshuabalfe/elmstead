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

### Requirement: Corner views use true directions
The `sw`, `se`, `ne` and `nw` views SHALL look at the model from that true compass direction, turned
from plan axes by the model's `northAngle`. That applies to the buttons, `?view=` and the snapshot
cameras. A model with no `northAngle` SHALL keep its current corner views.

#### Scenario: North-east view of a turned model
- **WHEN** the viewer shows the `ne` view of a model whose `northAngle` is 135°
- **THEN** the camera stands to the model's true north-east, which is plan −x, looking at its centre

#### Scenario: Corner view without a north angle
- **WHEN** the viewer shows the `ne` view of a model with no `northAngle`
- **THEN** the camera stands to plan +x, +y, as before

### Requirement: Project orientation override
`?orient=project` SHALL make the viewer ignore `northAngle` when it orients its views. The Top view
SHALL keep plan +y up and the corner views SHALL use plan directions. The compass SHALL still point
to true north. Any other value, or none, SHALL mean true north orientation.

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
The snapshot cameras SHALL be perspective `sw`, `se`, `ne` and `nw`, each looking from that true
compass direction, and an orthographic `top`, true north up.
Snapshots SHALL show the IFC's own colours with labels off, apart from the stair readability
presentation, which snapshots keep so the steps read there too.

#### Scenario: One snapshot per camera
- **WHEN** `render` writes a model's snapshots
- **THEN** there are five, `sw`, `se`, `ne`, `nw` and `top`, in the IFC's colours (stairs in their
  readability presentation) with no room labels or dimensions

#### Scenario: Snapshots of a turned model
- **WHEN** `render` writes the snapshots of a model whose `northAngle` is 135°
- **THEN** `3d-ne.png` shows the model from its true north-east, and `3d-top.png` has true north up
