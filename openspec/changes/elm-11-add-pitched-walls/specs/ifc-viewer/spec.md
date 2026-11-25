# Spec Delta

## MODIFIED Requirements

### Requirement: Plan style
Interactively, the viewer SHALL use a plan style:
- each shown storey's room fills and door swings as its floor, at its own level, hiding the storeys below;
- wall tops and sills in the plan's charcoal, unlit;
- the plan's wall pieces, door gaps and window symbols 5 mm above the wall tops;
- each storey's room names, areas and dimensions on a plane at its ceiling, hidden by any storey above;
- a white background and no grid.

The flat wall-piece overlay SHALL cover only flat-topped walls, as one plane per wall height laid
5 mm above that height's wall tops. A pitched wall's sloped top SHALL be painted charcoal by the
wall-top shader instead, so no flat overlay floats above the slope or above shorter walls.

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

#### Scenario: Pitched wall beside flat eaves walls
- **WHEN** a storey has a pitched gable wall alongside flat eaves walls in plan style
- **THEN** the gable's sloped top reads charcoal and the flat wall-piece overlay sits at the eaves walls' height, with no flat plane floating at the ridge

#### Scenario: Flat walls of different heights
- **WHEN** a storey has a tall front wall and shorter eaves walls at the back in plan style
- **THEN** each wall's poché overlay sits at its own top, with no plane floating above the shorter walls
