# Spec Delta

## MODIFIED Requirements

### Requirement: Plan geometry
The plan SHALL draw, in order:
1. slab outlines, dashed;
2. room fills;
3. walls at their true thickness, split around openings;
4. door leaves with swing arcs;
5. window symbols: an outline, two glazing lines, and a block for each frame piece or vertical bar the cut passes through;
6. stairs: flight footprints, tread lines, landing outlines and a walking-direction arrow for each flight.

#### Scenario: Door in a wall
- **WHEN** a wall has a door
- **THEN** the wall is drawn in pieces either side of the opening and the door shows a leaf and swing arc on the side it opens to

#### Scenario: Stair in the plan
- **WHEN** a storey has a half-turn stair
- **THEN** the plan draws both flight footprints, their tread lines, the landing outline and an arrow on each flight

### Requirement: Queryable SVG
Every element SHALL be an SVG group with a `class` (`wall`, `door`, `window`, `room`,
`room-dimensions`, `slab`, `stair`, `stair-flight` or `stair-landing`) and a `data-id` of its model
id.

#### Scenario: Finding a wall
- **WHEN** the SVG is queried for `[data-id="wall-south"]`
- **THEN** it returns the group drawing that wall

#### Scenario: Finding a stair flight
- **WHEN** the SVG is queried for `[data-id="stair-flight-lower"]`
- **THEN** it returns the group drawing that flight

## ADDED Requirements

### Requirement: Stair symbols
Each stair SHALL be an SVG group with class `stair` and its model id. Its flights and landings SHALL
be groups with classes `stair-flight` and `stair-landing` and their ids. A flight SHALL draw its
footprint, tread lines at each going and an arrow along its walking direction; a landing SHALL draw
its outline. Stairs SHALL be drawn in full, not cut at the plan cut height.

#### Scenario: Half-turn stair symbols
- **WHEN** a stair has two flights and one landing
- **THEN** the plan has two `stair-flight` groups, one `stair-landing` group and two walking-direction arrows

#### Scenario: Stair ids with the flag
- **WHEN** render runs with `--ids`
- **THEN** the stair, flight and landing ids are drawn on the plan

#### Scenario: Stair outside the room outlines
- **WHEN** a stair lies outside every room and slab outline
- **THEN** the plan's drawing extent still includes it

#### Scenario: Stair above the cut plane
- **WHEN** the half landing is above the 1200 mm cut height
- **THEN** the plan still draws the landing and upper flight