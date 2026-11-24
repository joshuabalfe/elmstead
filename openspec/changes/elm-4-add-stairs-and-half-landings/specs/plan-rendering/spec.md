# Spec Delta

## MODIFIED Requirements

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
its outline. Stairs SHALL be the last geometry layer, after the window symbols, and SHALL be drawn
in full rather than cut.

#### Scenario: Half-turn stair symbols
- **WHEN** a stair has two flights and one landing
- **THEN** the plan has two `stair-flight` groups, one `stair-landing` group and two walking-direction arrows

#### Scenario: Stair ids with the flag
- **WHEN** render runs with `--ids`
- **THEN** the stair, flight and landing ids are drawn on the plan

#### Scenario: Stair outside the room outlines
- **WHEN** a stair lies outside every room and slab outline
- **THEN** the plan's drawing extent still includes it

#### Scenario: Landing above the cut height
- **WHEN** a half landing sits at 1525 mm, above `CUT_HEIGHT`
- **THEN** the plan still draws the landing and the upper flight, because `CUT_HEIGHT` gates only which openings are cut

### Requirement: Stairs stay out of the viewer's plan overlay
Stairs SHALL be drawn by `renderPlan` alone. `renderFloor`, `renderWallTops` and
`renderPlanAnnotations`, which `viewer/main.ts` composites into its plan-style overlay, SHALL NOT
draw them, so the plan-style overlay is unchanged. The viewer's stair readability recolour is
separate presentation (see `ifc-viewer`), not part of the overlay.

#### Scenario: Shared renderer functions emit no stair
- **WHEN** `renderFloor`, `renderWallTops` or `renderPlanAnnotations` runs on a storey with a stair
- **THEN** its SVG contains no `stair`, `stair-flight` or `stair-landing` group

#### Scenario: Viewer overlay is unchanged
- **WHEN** the viewer builds its plan-style overlay for a storey with a stair
- **THEN** the overlay is what it was before this change, and the stair appears only as IFC geometry

### Requirement: Stair plan colours
Stair flights, landings, tread lines and arrows SHALL be drawn in colours that the plan-versus-3D
comparison classifies as neither wall, room nor paper, so stair pixels on the plan are ignored rather
than compared against the 3D top view. The stair line colour SHALL NOT be the plan's wall colour,
whose long runs also set the comparison's alignment box.

#### Scenario: Stair pixels are not comparable
- **WHEN** the plan-versus-3D comparison classifies a pixel of a stair flight, tread line or landing
- **THEN** it classifies as neither wall, room nor paper, and the comparison skips it

#### Scenario: Stair drawn in the wall colour
- **WHEN** a stair's footprint is drawn in the plan's wall colour
- **THEN** the comparison treats it as wall pixels on the plan and nothing on the 3D side, which is a defect this requirement prevents