# Spec Delta

## MODIFIED Requirements

### Requirement: Plan style
Interactively, the viewer SHALL use a plan style:
- the plan's room fills and door swings drawn under the model as the floor;
- slab top faces not drawn so those fills show, but only in the orthographic Top view;
- wall tops and sills in the plan's charcoal, unlit;
- the plan's wall pieces, door gaps and window symbols 5 mm above the wall tops;
- a white background and no grid.

`?style=ifc` or `?style=plan` SHALL force a style.

#### Scenario: Top view
- **WHEN** the interactive viewer shows the top view
- **THEN** it reads like the plan drawing without cutting the model

#### Scenario: Upper floor from a corner view
- **WHEN** a model with two storeys is shown in plan style from a corner view or in walk mode
- **THEN** the upper storey's slab is solid, and the storey below it is hidden rather than showing through

#### Scenario: Upper floor from directly above, but not the Top view
- **WHEN** a perspective camera looks straight down at the upper storey's slab
- **THEN** the slab is still solid, because only the orthographic Top view stands the plan's room fills in for it
