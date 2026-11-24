# Spec Delta

## ADDED Requirements

### Requirement: Ground presentation
The viewer SHALL recognise a ground slab's material as ground, not as a wall or concrete slab, and
present it in the ground colour in both plan style and 3D. In plan style the ground SHALL read as a
floor fill like other slabs, and the ground colour SHALL NOT disturb the plan-versus-3D comparison.

#### Scenario: Ground in 3D
- **WHEN** the viewer shows a ground slab in 3D or `?style=ifc`
- **THEN** its top face appears in the ground colour

#### Scenario: Ground in plan style
- **WHEN** the viewer shows a ground slab in plan style
- **THEN** the ground reads as a floor fill and the plan-versus-3D comparison is unchanged