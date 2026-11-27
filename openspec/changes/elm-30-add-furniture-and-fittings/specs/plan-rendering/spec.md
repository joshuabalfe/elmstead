# Spec Delta

## MODIFIED Requirements

### Requirement: Queryable SVG

Every element SHALL be an SVG group with a `class` (`wall`, `door`, `window`, `room`,
`room-dimensions`, `slab`, `stair`, `stair-flight`, `stair-landing`, `railing` or `furnishing`) and a
`data-id` of its model id.

#### Scenario: Finding a wall

- **WHEN** the SVG is queried for `[data-id="wall-south"]`
- **THEN** it returns the group drawing that wall

#### Scenario: Finding a stair flight

- **WHEN** the SVG is queried for `[data-id="stair-flight-lower"]`
- **THEN** it returns the group drawing that flight

#### Scenario: Finding a railing

- **WHEN** the SVG is queried for `[data-id="railing-front-north"]`
- **THEN** it returns the group drawing that railing

#### Scenario: Finding a furnishing

- **WHEN** the SVG is queried for `[data-id="sofa-living"]`
- **THEN** it returns the group drawing that furnishing

## ADDED Requirements

### Requirement: Furnishing symbols

The plan SHALL draw each furnishing as the outline of the footprint of each of its parts, leaving
out a part whose footprint lies wholly inside the footprint of a higher part, so what shows is what
is seen from above. Outlines SHALL follow the furnishing's rotation and use a furnishing colour
distinct from the wall, room and paper colours the plan-versus-3D comparison classifies. Furnishings
SHALL be drawn after walls and openings and before railings and stairs.

#### Scenario: Table seen from above

- **WHEN** a storey has a table
- **THEN** the plan has a `furnishing` group with the table's id containing one rectangle, the tabletop, and no outlines for its legs

#### Scenario: Chair has a seat and a back

- **WHEN** a storey has a chair
- **THEN** its group contains an outline for the seat and one for the back, and none for the legs beneath the seat

#### Scenario: Bath shows its recess

- **WHEN** a storey has a bath
- **THEN** its group contains the outer outline of the rim and the inner outline of the recessed floor

#### Scenario: Rotated furnishing

- **WHEN** a sofa has `rotation: 90` and the plan is drawn with the project orientation
- **THEN** its outlines are the unrotated outlines turned a quarter turn counter-clockwise about its `at`

#### Scenario: Furnishing on a north-up sheet

- **WHEN** a plan is drawn true north up for a site with a non-zero `northAngle`
- **THEN** each furnishing's outlines are turned with the rest of the drawing, so they keep their place against the walls

#### Scenario: Furnishing pixels are not comparable

- **WHEN** the plan-versus-3D comparison classifies a pixel of a furnishing colour
- **THEN** it classifies as neither wall, room nor paper, and the comparison skips it

#### Scenario: Furnishing layer order

- **WHEN** a storey has a furnishing, a railing and a stair
- **THEN** the furnishing group is drawn after the walls and before the railing and stair groups

#### Scenario: Unfurnished storey

- **WHEN** a storey has no furnishings
- **THEN** its plan has no `furnishing` group

### Requirement: Furnishing plan extent

The plan's drawing extent SHALL include furnishing footprints even when they lie outside every room,
slab and stair outline. `renderFloor`, `renderWallTops` and `renderPlanAnnotations` SHALL NOT draw
furnishings and SHALL keep the extent they had before furnishings existed, so the viewer's
plan-style overlay is unchanged.

#### Scenario: Furnishing outside the outlines

- **WHEN** a furnishing lies outside every room, slab and stair outline
- **THEN** the plan's drawing extent still includes its footprint

#### Scenario: Viewer overlay extent unchanged

- **WHEN** `renderFloor`, `renderWallTops` or `renderPlanAnnotations` runs on a storey with an outlying furnishing
- **THEN** its bounds equal the bounds for the same storey with the furnishing removed

#### Scenario: Shared renderers emit no furnishing

- **WHEN** `renderFloor`, `renderWallTops` or `renderPlanAnnotations` runs on a storey with a furnishing
- **THEN** its SVG contains no furnishing group

### Requirement: Furnishing ids

With `--ids`, the plan SHALL draw each furnishing's id in red like any other element's; without the
flag it SHALL draw none.

#### Scenario: Furnishing id with the flag

- **WHEN** render runs with `--ids` on a storey with a furnishing
- **THEN** the furnishing's id is drawn in red

#### Scenario: Furnishing id without the flag

- **WHEN** render runs without `--ids`
- **THEN** no furnishing id is drawn
