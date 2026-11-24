# Spec Delta

## ADDED Requirements

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

#### Scenario: Upper storey alone
- **WHEN** the viewer is opened with `?storeys=` naming only an upper storey
- **THEN** that storey alone is drawn and the selector shows a disabled custom value

### Requirement: Floors stack occlusively
In plan style each shown storey's floor SHALL be its own room fills and door swings, at that
storey's level, drawn so that it hides everything below it. A slab SHALL render only its downward
face: its underside, the ceiling of the storey below. Its top and its edges SHALL NOT be drawn, so
the fills are the floor and no grey band crosses the facade.

#### Scenario: Whole building from a corner
- **WHEN** every storey of a two-storey model is shown in a corner view
- **THEN** the upper storey's floor and walls hide the ground floor behind and beneath them

#### Scenario: Whole building from above
- **WHEN** every storey is shown in the top view
- **THEN** the topmost storey's room fills are the floor, and no lower storey shows through them

#### Scenario: Slab edges from outside
- **WHEN** a two-storey model is shown in plan style from outside, at any height
- **THEN** no grey slab edge crosses the facade; the walls read continuous from the ground to the top

#### Scenario: Looking up from inside
- **WHEN** walk mode stands on the ground floor of a two-storey model
- **THEN** the first floor's slab underside is the ceiling, and its fills do not bleed through it

## MODIFIED Requirements

### Requirement: Plan style
Interactively, the viewer SHALL use a plan style:
- each shown storey's room fills and door swings as its floor, at its own level, hiding the storeys below;
- wall tops and sills in the plan's charcoal, unlit;
- the plan's wall pieces, door gaps and window symbols 5 mm above the wall tops;
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
The test suite SHALL build each model and, for every storey, render the viewer's top view with only
that storey shown and compare it with that storey's plan in overlapping 500 mm tiles. Pixels are
classified as wall, room fill or paper. A tile SHALL fail above 10% mismatch, and failures SHALL be
reported in metres from the outer walls' south-west corner.

#### Scenario: Room outline on a wall centreline
- **WHEN** a room outline runs to a wall's centreline instead of its face
- **THEN** the plan-versus-3D test fails on the affected tiles

#### Scenario: Two storeys with different layouts
- **WHEN** a model's storeys have different wall layouts
- **THEN** each storey's plan is compared against the top view of that storey alone, and both pass

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
