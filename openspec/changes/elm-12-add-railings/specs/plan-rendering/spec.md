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
plan-versus-3D comparison classifies. The drawing extent SHALL include railing points even when they
lie outside every room and slab. Railings SHALL be drawn by `renderPlan` only; `renderFloor`,
`renderWallTops` and `renderPlanAnnotations` SHALL NOT draw them, so the viewer's plan-style
overlay is unchanged.

#### Scenario: Railing on the plan
- **WHEN** a storey has a railing
- **THEN** the plan has a `railing` group with the railing's id, drawn as a line with post ticks

#### Scenario: Railing outside the outlines
- **WHEN** a railing lies outside every room and slab outline
- **THEN** the plan's drawing extent still includes it

#### Scenario: Railing pixels are not comparable
- **WHEN** the plan-versus-3D comparison classifies a pixel of the railing colour
- **THEN** it classifies as neither wall, room nor paper, and the comparison skips it

#### Scenario: Shared renderers emit no railing
- **WHEN** `renderFloor`, `renderWallTops` or `renderPlanAnnotations` runs on a storey with a railing
- **THEN** its SVG contains no railing group
