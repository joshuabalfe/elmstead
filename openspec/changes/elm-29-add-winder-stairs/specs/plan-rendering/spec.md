# Spec Delta

## MODIFIED Requirements

### Requirement: Queryable SVG

Every element SHALL be an SVG group with a `class` (`wall`, `door`, `window`, `room`,
`room-dimensions`, `slab`, `stair`, `stair-flight`, `stair-landing`, `stair-winder` or `railing`) and a
`data-id` of its model id.

#### Scenario: Finding a wall

- **WHEN** the SVG is queried for `[data-id="wall-south"]`
- **THEN** it returns the group drawing that wall

#### Scenario: Finding a stair flight

- **WHEN** the SVG is queried for `[data-id="stair-flight-lower"]`
- **THEN** it returns the group drawing that flight

#### Scenario: Finding a stair winder

- **WHEN** the SVG is queried for `[data-id="stair-winder-turn"]`
- **THEN** it returns the group drawing that winder

#### Scenario: Finding a railing

- **WHEN** the SVG is queried for `[data-id="railing-front-north"]`
- **THEN** it returns the group drawing that railing

### Requirement: Stairs stay out of the viewer's plan overlay

Stairs SHALL be drawn by `renderPlan` alone. `renderFloor`, `renderWallTops` and
`renderPlanAnnotations`, which `viewer/main.ts` composites into its plan-style overlay, SHALL NOT
draw them, so the plan-style overlay is unchanged. The viewer's stair readability recolour is
separate presentation (see `ifc-viewer`), not part of the overlay.

#### Scenario: Shared renderer functions emit no stair

- **WHEN** `renderFloor`, `renderWallTops` or `renderPlanAnnotations` runs on a storey with a stair
- **THEN** its SVG contains no `stair`, `stair-flight`, `stair-landing` or `stair-winder` group

#### Scenario: Viewer overlay is unchanged

- **WHEN** the viewer builds its plan-style overlay for a storey with a stair
- **THEN** the overlay is what it was before this change, and the stair appears only as IFC geometry

## ADDED Requirements

### Requirement: Winder symbols

A winder SHALL be a group with class `stair-winder` and its model id inside its stair's group. It
SHALL draw its outline, a tread line along each interior fan line and an arrow along its walking
line, from the middle of its entry edge to the start of the flight after it. It SHALL be drawn in the
stair layer, in full rather than cut.

#### Scenario: Winding stair symbols

- **WHEN** a stair has a winder of 3 risers and one flight
- **THEN** the plan has one `stair-winder` group with two fan tread lines, one `stair-flight` group and two walking-direction arrows

#### Scenario: Winder ids with the flag

- **WHEN** render runs with `--ids` on a model with a winder
- **THEN** the winder's id is drawn on the plan with the stair and flight ids

#### Scenario: Winder outside the room outlines

- **WHEN** a winder lies outside every room and slab outline
- **THEN** the plan's drawing extent still includes it
