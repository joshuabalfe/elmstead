# Spec Delta

## ADDED Requirements

### Requirement: Plan overlays as geometry
In plan style the viewer SHALL draw the floor, wall-top and annotation overlays from their drawing
primitives as scene geometry, not as raster images of the drawing. Fills SHALL be flat and unlit in
the plan's colours, and strokes and dashes SHALL be as wide and as long as on the plan at its scale
(1 px = 10 mm). Text SHALL lie flat where the plan places it, at the plan's size and rotation.

#### Scenario: Sharp at close range
- **WHEN** the camera is brought close to a window symbol or a dimension line in plan style
- **THEN** its edges stay sharp, with no texel blur or stair-stepping from a raster image

#### Scenario: Plan and 3D still agree
- **WHEN** the plan-versus-3D comparison runs after this change
- **THEN** every storey it compares passes as before

#### Scenario: Floors still stack
- **WHEN** every storey is shown in the top view
- **THEN** the topmost storey's floor fills hide the storeys below, as *Floors stack occlusively*
  requires

### Requirement: Overlay textures stay small
No texture the viewer uploads for its overlays or labels SHALL exceed 1,048,576 texels (1024 × 1024
or equivalent). The texture memory SHALL depend on the amount of text, not on a storey's footprint.

#### Scenario: Loading the Elmstead model
- **WHEN** the viewer loads the Elmstead model in plan style with labels on
- **THEN** no uploaded texture exceeds the bound

#### Scenario: A larger footprint
- **WHEN** a storey's footprint grows and its text stays the same
- **THEN** the overlays' texture memory stays about the same
