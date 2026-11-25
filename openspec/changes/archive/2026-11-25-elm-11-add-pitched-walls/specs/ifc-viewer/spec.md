# Spec Delta

## MODIFIED Requirements

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
The test suite SHALL build each model and, for every storey whose walls are all flat-topped, render
the viewer's top view with only that storey shown and compare it with that storey's plan in
overlapping 500 mm tiles. Pixels are classified as wall, room fill or paper. A tile SHALL fail above
10% mismatch, and failures SHALL be reported in metres from the outer walls' south-west corner.

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

## ADDED Requirements

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
