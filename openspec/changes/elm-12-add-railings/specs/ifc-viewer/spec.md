# Spec Delta

## ADDED Requirements

### Requirement: Railing presentation
The viewer SHALL recognise a railing's IFC colour as a railing and show it in that colour in 3D and
in plan style, as it shows other IFC geometry. The plan overlay SHALL NOT draw railings and SHALL
NOT change because of them. Railing pixels SHALL classify as neither wall, room nor paper in the
plan-versus-3D comparison, so the comparison skips them.

#### Scenario: Railing in 3D
- **WHEN** the viewer shows a model with railings in 3D or `?style=ifc`
- **THEN** the rail and its posts appear in the railing colour

#### Scenario: Railing in plan style
- **WHEN** the viewer shows a model with railings in plan style
- **THEN** the railing appears as IFC geometry in the railing colour and the plan overlay is unchanged

#### Scenario: Railing pixels are not compared
- **WHEN** the plan-versus-3D comparison sees the railing colour
- **THEN** it classifies as neither wall, room nor paper and is skipped
