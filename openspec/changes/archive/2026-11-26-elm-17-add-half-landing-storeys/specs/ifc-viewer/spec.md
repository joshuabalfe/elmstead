# Spec Delta

## MODIFIED Requirements

### Requirement: Plan and 3D agree
The test suite SHALL build each model and, for every storey whose walls are all flat-topped and
span at least 2 m in both plan directions, render the viewer's top view with only that storey shown
and compare it with that storey's plan in overlapping 500 mm tiles. Pixels are classified as wall,
room fill or paper. A tile SHALL fail above 10% mismatch, and failures SHALL be reported in metres
from the outer walls' south-west corner.

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

#### Scenario: Storey with walls too small to align on
- **WHEN** a storey's walls span less than 2 m in either plan direction, such as a half-landing storey framed by a 1.4 m extension or by one wall
- **THEN** the comparison skips that storey, because it aligns the two pictures on the walls' extent and those walls give it too few wall pixels per row or column to find it
