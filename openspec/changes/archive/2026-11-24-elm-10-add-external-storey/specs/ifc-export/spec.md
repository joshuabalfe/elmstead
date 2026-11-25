# Spec Delta

## ADDED Requirements

### Requirement: Ground display colour
A slab whose material is `ground` SHALL carry the `ground` entry's surface colour; a concrete slab
SHALL keep the existing slab colour.

#### Scenario: Ground slab colour
- **WHEN** a model has a slab with `material: "ground"`
- **THEN** the IFC gives it the ground display colour, distinct from concrete slabs

#### Scenario: Concrete slab unchanged
- **WHEN** a slab omits `material`
- **THEN** its display colour is the existing slab colour, byte-identical to before this change

## MODIFIED Requirements

### Requirement: Display colours
Walls, slabs, doors, glazing, frames and bars, stair flights and stair landings, and ground slabs
SHALL carry `IfcStyledItem` surface colours. The colours only help tell elements apart and have no
building meaning. The stair and ground colours SHALL each be at least 0.02 away in RGB distance from
every other entry in `STYLES`, so the viewer's `styleOf` recognises them as themselves rather than
as a wall or a slab and patching their upward faces.

#### Scenario: Viewer colours
- **WHEN** the IFC is opened in any viewer
- **THEN** walls, slabs, doors and glazing appear in distinct colours

#### Scenario: Stair colours
- **WHEN** the IFC is opened in any viewer
- **THEN** stair flights and landings appear in a colour distinct from walls, slabs, doors and glazing

#### Scenario: Stair material is not recognised as a wall or slab
- **WHEN** the viewer's plan style looks for the wall and slab colours among a stair's material
- **THEN** it finds neither, so the classifier leaves the stair material alone instead of painting its tops charcoal or discarding them (the readability recolour is a separate shader, see `ifc-viewer`)