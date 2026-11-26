# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
