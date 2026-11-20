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

#### Scenario: Window with a reveal
- **WHEN** a window the cut passes through has a reveal on its wall's left face
- **THEN** the wall pieces either side end square from the right face to the middle and angled from the middle to the left face, and the window's outline fills the splayed gap

### Requirement: Plan annotations
Over the geometry the plan SHALL draw, in order:
1. room labels (name and area in m²) and room dimensions: the longest clear wall-to-wall span east–west and north–south;
2. element ids in red, only with `--ids`;
3. overall dimensions;
4. a title, a north arrow and a 5 m scale bar.

#### Scenario: Ids flag
- **WHEN** render runs with `--ids`
- **THEN** every element's id is drawn on the plan in red, and without the flag none are

### Requirement: Queryable SVG
Every element SHALL be an SVG group with a `class` (`wall`, `door`, `window`, `room`,
`room-dimensions` or `slab`) and a `data-id` of its model id.

#### Scenario: Finding a wall
- **WHEN** the SVG is queried for `[data-id="wall-south"]`
- **THEN** it returns the group drawing that wall

### Requirement: Deterministic drawings
Numbers in the SVG SHALL have one decimal place. Text SHALL use the bundled DejaVu fonts, and resvg
SHALL NOT load system fonts, so the same model gives the same SVG and PNG on every machine. The
example cottage's ground-floor SVG SHALL be snapshot-tested.

#### Scenario: Renderer change
- **WHEN** the plan output changes
- **THEN** `npm test` fails on the SVG snapshot until it is reviewed and updated with `npx vitest run -u`
