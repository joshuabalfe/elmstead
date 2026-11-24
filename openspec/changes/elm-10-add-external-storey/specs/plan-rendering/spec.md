# Spec Delta

## ADDED Requirements

### Requirement: Ground floor fill
The plan SHALL draw a slab whose material is `ground` with a ground-coloured fill, distinct from
room fills and from the wall, room and paper colours the plan-versus-3D comparison classifies. A
concrete slab SHALL keep its existing presentation.

#### Scenario: Ground slab fill
- **WHEN** a storey has a slab with `material: "ground"`
- **THEN** the plan fills its outline with the ground colour, distinct from room fills

#### Scenario: Ground pixels are not comparable
- **WHEN** the plan-versus-3D comparison classifies a pixel of a ground fill
- **THEN** it classifies as neither wall, room nor paper, and the comparison skips it