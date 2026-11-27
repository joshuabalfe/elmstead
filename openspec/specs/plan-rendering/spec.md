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

1. slab outlines, dashed, with ground slabs filled in the ground colour;
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

### Requirement: Ground floor fill

The plan SHALL draw a slab whose material is `ground` with a ground-coloured fill in the floor
layer, beneath room fills, in both the plan and the viewer's floor overlay. The colour SHALL be
distinct from room fills and from the wall, room and paper colours the plan-versus-3D comparison
classifies. A concrete slab SHALL keep its existing presentation.

#### Scenario: Ground slab fill

- **WHEN** a storey has a slab with `material: "ground"`
- **THEN** the plan fills its outline with the ground colour, distinct from room fills

#### Scenario: Viewer floor overlay

- **WHEN** the viewer composites its plan-style floor for a storey with a ground slab
- **THEN** the ground reads in the ground colour, not the room-fill colour

#### Scenario: Ground pixels are not comparable

- **WHEN** the plan-versus-3D comparison classifies a pixel of a ground fill
- **THEN** it classifies as neither wall, room nor paper, and the comparison skips it

### Requirement: Plan annotations

Over the geometry the plan SHALL draw, in order:

1. room labels (name and area in m²) and room dimensions: the longest clear wall-to-wall span along plan x and along plan y of the room's `dimensionOutline` when it has one, otherwise its `outline`;
2. element ids in red, only with `--ids`;
3. overall dimensions, along plan x and plan y of the drawing's extent;
4. a title, a north arrow pointing to true north (straight up on a true-north-up plan), and a 5 m scale bar.

#### Scenario: Ids flag

- **WHEN** render runs with `--ids`
- **THEN** every element's id is drawn on the plan in red, and without the flag none are

#### Scenario: Room with a dimension outline

- **WHEN** a room has a `dimensionOutline`
- **THEN** its dimension figures measure that outline, while its label and area use `outline`

#### Scenario: North arrow

- **WHEN** a plan is drawn true north up
- **THEN** its north arrow points straight up the sheet, whatever the model's `northAngle`

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

### Requirement: Overlay drawings as primitives

The floor, wall-top and annotation overlays SHALL each be available as drawing primitives with the
plan area they cover. A primitive is a filled or stroked polygon, a polyline, a line or a text,
carrying its colours, stroke width and dash pattern explicitly, in drawing order. Each overlay's SVG
SHALL be serialised from those primitives, so the SVG and the primitives always agree.

#### Scenario: SVG and primitives agree

- **WHEN** an overlay is rendered for a storey
- **THEN** serialising its primitives gives exactly its SVG

#### Scenario: Explicit styling

- **WHEN** the annotation overlay is rendered
- **THEN** each dimension line carries its stroke colour and width, and each figure its halo, on the
  primitive itself rather than from a stylesheet, and the SVG renders as it did before

#### Scenario: Plan sheet unchanged

- **WHEN** `renderPlan` runs on a model after this change
- **THEN** its SVG is byte for byte what it was before, and the plan snapshot test passes unchanged

### Requirement: Plans are drawn true north up

The plan SHALL be drawn turned by the site's `northAngle`, so true north points straight up the
sheet, as on a site location plan. The sheet SHALL be sized to the turned drawing, with the usual
margins. Text SHALL stay upright, and dimension figures SHALL read along their lines. A model with
no `northAngle` SHALL draw as before. The scale and the queryable groups SHALL be unchanged.

#### Scenario: Model with a north angle

- **WHEN** a model's `northAngle` is 135°
- **THEN** its plans are turned 135° clockwise on the sheet, so plan +y points down and to the right, and every wall stays within the sheet's margins

#### Scenario: Model with no north angle

- **WHEN** a model has no `northAngle`
- **THEN** its plans are identical to those drawn without this requirement, and the example cottage's SVG snapshot is unchanged

#### Scenario: Room labels on a turned plan

- **WHEN** a plan is turned
- **THEN** room names and areas are horizontal on the sheet, and the room dimension lines lie along the room's turned walls, with their figures kept clear of the label

### Requirement: Project orientation on request

The plan renderer SHALL also draw a storey in project orientation, with plan +y up and no turn,
when asked to. Comparisons that align on rows and columns of wall pixels SHALL use this. `render`'s
output files SHALL always be true north up.

#### Scenario: Project orientation

- **WHEN** a plan is drawn in project orientation for a model whose `northAngle` is 135°
- **THEN** it is drawn with plan +y up, as without a north angle, and its north arrow points 135° counter-clockwise from up
