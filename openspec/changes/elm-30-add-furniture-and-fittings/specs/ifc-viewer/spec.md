# Spec Delta

## ADDED Requirements

### Requirement: Furnishing presentation

The viewer SHALL recognise the IFC colours of furniture and of sanitary fittings as such and show
each in its own colour in 3D and in plan style, as it shows other IFC geometry. The plan overlay
SHALL NOT draw furnishings and SHALL NOT change because of them. Furnishing pixels SHALL classify as
neither wall, room nor paper in the plan-versus-3D comparison, so the comparison skips them.

#### Scenario: Furnishings in 3D

- **WHEN** the viewer shows a model with a sofa and a bath in 3D or `?style=ifc`
- **THEN** the sofa appears in the furniture colour and the bath in the sanitary colour

#### Scenario: Furnishings in plan style

- **WHEN** the viewer shows a furnished storey in plan style
- **THEN** the furnishings appear as IFC geometry in their colours and the plan overlay is unchanged

#### Scenario: Furnishing pixels are not compared

- **WHEN** the plan-versus-3D comparison sees a furnishing colour
- **THEN** it classifies as neither wall, room nor paper and is skipped

### Requirement: Furnishing storey visibility

A furnishing SHALL be hidden when its storey is hidden, like the storey's other geometry.

#### Scenario: Hiding the furnishing's storey

- **WHEN** a furnished storey is hidden with `?storeys=` or the selector
- **THEN** its furnishings are hidden with it

#### Scenario: Showing the furnishing's storey

- **WHEN** the storey is shown again
- **THEN** its furnishings are shown

### Requirement: Outlying furnishing framing

A furnishing outside the walls, slabs and rooms SHALL be included in the viewer's shown bounds for
3D views and walk entry, so it is not cropped, and its top SHALL count towards its storey's height.

#### Scenario: Outlying furnishing in the view

- **WHEN** a model has a furnishing outside its walls, slabs and rooms
- **THEN** the 3D views and walk entry include the furnishing in the framed bounds

#### Scenario: Furnishing on a storey with no walls

- **WHEN** a storey has furnishings and no walls, and its furnishings reach higher than its slabs
- **THEN** the storey's height in the viewer reaches the top of its tallest furnishing

### Requirement: Furnishing identity

Hovering or picking a furnishing SHALL show its id, like any other element.

#### Scenario: Hover a chair

- **WHEN** the pointer is over one part of a chair
- **THEN** the label shows the chair's id, not a part name
