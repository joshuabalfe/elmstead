# Spec Delta

## ADDED Requirements

### Requirement: Ground display colour
A slab whose material is `ground` SHALL carry an `IfcStyledItem` surface colour from a `ground`
entry in `STYLES`, distinct from the concrete slab colour. A concrete slab SHALL keep the existing
slab colour. The ground colour SHALL be at least 0.02 away in RGB distance from every other `STYLES`
entry, so the viewer's material matching recognises it as ground rather than as a wall or slab.

#### Scenario: Ground slab colour
- **WHEN** a model has a slab with `material: "ground"`
- **THEN** the IFC gives it the ground display colour, distinct from concrete slabs

#### Scenario: Concrete slab unchanged
- **WHEN** a slab omits `material`
- **THEN** its display colour is the existing slab colour, byte-identical to before this change