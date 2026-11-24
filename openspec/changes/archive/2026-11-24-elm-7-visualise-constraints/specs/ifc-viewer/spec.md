# Spec Delta

## ADDED Requirements

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