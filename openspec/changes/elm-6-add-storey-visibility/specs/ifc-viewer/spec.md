# Spec Delta

## ADDED Requirements

### Requirement: Storey visibility
`?storeys=` SHALL take a comma-separated list of storey ids and show only those storeys. Omitting it
SHALL show every storey, as today. An id that names no storey SHALL be ignored, with a note in the
status line, rather than failing to render. Hiding a storey SHALL hide everything the IFC contains
or aggregates in it, and the annotations and plan layers drawn for it.

#### Scenario: One storey of two
- **WHEN** the viewer is opened with `?storeys=storey-ground` on a two-storey model
- **THEN** only the ground storey's walls, openings, slabs, rooms and stairs are drawn, with its labels

#### Scenario: Unknown storey id
- **WHEN** `?storeys=` names an id that is not a storey of the model
- **THEN** every storey is shown and the status line names the id that was not found

#### Scenario: Omitted
- **WHEN** the URL has no `storeys` parameter
- **THEN** every storey is shown

### Requirement: Multi-storey views render occlusively
With more than one storey shown the viewer SHALL render the IFC's own colours, with nearer walls and
floors hiding what is behind and beneath them. It SHALL keep the white background, the absence of a
grid and the room annotations, and SHALL draw no floor fills and discard no slab tops.

#### Scenario: Whole building from a corner
- **WHEN** every storey of a two-storey model is shown in a corner view
- **THEN** the upper storey's walls and slab hide the ground floor behind and beneath them

#### Scenario: Whole building from above
- **WHEN** every storey is shown in the top view
- **THEN** the topmost slab is solid, and no lower storey shows through it

## MODIFIED Requirements

### Requirement: Plan style
Plan style SHALL apply when exactly one storey is shown, drawing for that storey:
- the plan's room fills and door swings under the model as the floor;
- wall tops and sills in the plan's charcoal, unlit;
- the plan's wall pieces, door gaps and window symbols 5 mm above the wall tops;
- a white background and no grid.

`?style=ifc` SHALL force the IFC colours; `?style=plan` SHALL force plan style, or the IFC colours
when several storeys are shown.

#### Scenario: Top view
- **WHEN** the interactive viewer shows the top view
- **THEN** it reads like the plan drawing without cutting the model

#### Scenario: Upper storey alone
- **WHEN** only an upper storey is shown in the top view
- **THEN** its own room fills are the floor, at its own elevation

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
