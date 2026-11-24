# plan-rendering Specification

## Purpose
Per-storey plan drawings drawn as SVG straight from the model, not from the IFC, and rasterised to
PNG (`src/render/plan.ts`, `png.ts`, `style.ts`). The plans are the quickest visual check of an
edit.

## Requirements

### Requirement: One plan per storey
`render` SHALL write `out/<name>.<storey-id>.plan.svg` and a PNG of it for every storey. The SVG
SHALL be at 1 px = 10 mm and the PNG rasterised at 2×.

#### Scenario: Two-storey model
- **WHEN** a model has storeys `storey-ground` and `storey-first`
- **THEN** render writes a plan SVG and PNG for each

### Requirement: Plan geometry
The plan SHALL draw, in order:
1. slab outlines, dashed;
2. room fills;
3. walls at their true thickness, split around openings, and cut to the splayed outline of a window with a reveal;
4. door leaves with swing arcs;
5. window symbols: an outline, two glazing lines, and a block for each frame piece or vertical bar the cut passes through. The outline SHALL follow a window's reveal, and so SHALL the dashed outline of a window the cut misses.

#### Scenario: Door in a wall
- **WHEN** a wall has a door
- **THEN** the wall is drawn in pieces either side of the opening and the door shows a leaf and swing arc on the side it opens to

#### Scenario: Doorway
- **WHEN** a wall has a door with `doorway: true`
- **THEN** the wall is drawn in pieces either side of the opening and no leaf or swing is drawn

#### Scenario: Window with a reveal
- **WHEN** a window the cut passes through has a reveal on its wall's left face
- **THEN** the wall pieces either side end square from the right face to the middle and angled from the middle to the left face, and the window's outline fills the splayed gap

### Requirement: Plan annotations
Over the geometry the plan SHALL draw, in order:
1. room labels (name and area in m²) and room dimensions: the longest clear wall-to-wall span east–west and north–south of the room's `dimensionOutline` when it has one, otherwise its `outline`;
2. element ids in red, only with `--ids`;
3. overall dimensions;
4. a title, a north arrow and a 5 m scale bar.

#### Scenario: Ids flag
- **WHEN** render runs with `--ids`
- **THEN** every element's id is drawn on the plan in red, and without the flag none are

#### Scenario: Room with a dimension outline
- **WHEN** a room has a `dimensionOutline`
- **THEN** its dimension figures measure that outline, while its label and area use `outline`

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

### Requirement: Deterministic drawings
Numbers in the SVG SHALL have one decimal place. Text SHALL use the bundled DejaVu fonts, and resvg
SHALL NOT load system fonts, so the same model gives the same SVG and PNG on every machine. The
example cottage's ground-floor SVG SHALL be snapshot-tested.

#### Scenario: Renderer change
- **WHEN** the plan output changes
- **THEN** `npm test` fails on the SVG snapshot until it is reviewed and updated with `npx vitest run -u`

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
