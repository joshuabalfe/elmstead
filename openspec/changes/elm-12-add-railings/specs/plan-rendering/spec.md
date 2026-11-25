# Spec Delta

## MODIFIED Requirements

### Requirement: Queryable SVG
Every element SHALL be an SVG group with a `class` (`wall`, `door`, `window`, `room`,
`room-dimensions`, `slab`, `stair`, `stair-flight`, `stair-landing` or `railing`) and a
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

## ADDED Requirements

### Requirement: Railing symbols
The plan SHALL draw each railing as a straight line from `start` to `end` with a tick at each
derived post position, in a railing colour distinct from the wall, room and paper colours the
plan-versus-3D comparison classifies. Railings SHALL be drawn after walls and openings and before
stairs, so stairs remain the last geometry layer.

#### Scenario: Railing on the plan
- **WHEN** a storey has a railing
- **THEN** the plan has a `railing` group with the railing's id, drawn as a line with post ticks

#### Scenario: Railing pixels are not comparable
- **WHEN** the plan-versus-3D comparison classifies a pixel of the railing colour
- **THEN** it classifies as neither wall, room nor paper, and the comparison skips it

#### Scenario: Railing layer order
- **WHEN** a storey has a railing and a stair
- **THEN** the railing group is drawn after the walls and before the stair group

### Requirement: Railing plan extent
The plan's drawing extent SHALL include railing points even when they lie outside every room, slab
and stair outline. `renderFloor`, `renderWallTops` and `renderPlanAnnotations` SHALL NOT draw
railings and SHALL keep the extent they had before the railing existed, so the viewer's plan-style
overlay is unchanged.

#### Scenario: Railing outside the outlines
- **WHEN** a railing lies outside every room, slab and stair outline
- **THEN** the plan's drawing extent still includes it

#### Scenario: Viewer overlay extent unchanged
- **WHEN** `renderFloor`, `renderWallTops` or `renderPlanAnnotations` runs on a storey with an
  outlying railing
- **THEN** its bounds equal the bounds for the same storey with the railing removed

#### Scenario: Shared renderers emit no railing
- **WHEN** `renderFloor`, `renderWallTops` or `renderPlanAnnotations` runs on a storey with a railing
- **THEN** its SVG contains no railing group

### Requirement: Railing ids
With `--ids`, the plan SHALL draw each railing's id in red like any other element's; without the
flag it SHALL draw none.

#### Scenario: Railing id with the flag
- **WHEN** render runs with `--ids` on a storey with a railing
- **THEN** the railing's id is drawn in red

#### Scenario: Railing id without the flag
- **WHEN** render runs without `--ids`
- **THEN** no railing id is drawn
