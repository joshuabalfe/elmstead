# Spec Delta

## MODIFIED Requirements

### Requirement: Spatial structure and units
The file SHALL nest `IfcProject` → `IfcSite` → `IfcBuilding` → `IfcBuildingStorey`. Each storey's
`Elevation` SHALL be the storey elevation. Walls, slabs, doors, windows and railings SHALL be
contained in their storey, and spaces SHALL be aggregated under it. Units SHALL be mm for length, m²
for area, m³ for volume and radians for plane angle.

#### Scenario: Storey contents
- **WHEN** a storey has walls, openings, slabs and rooms
- **THEN** its walls, slabs, doors and windows are contained in its `IfcBuildingStorey`, and its rooms are `IfcSpace`s aggregated under it

#### Scenario: Storey with a railing
- **WHEN** a storey has a railing
- **THEN** its `IfcRailing` is contained in its `IfcBuildingStorey`

### Requirement: Display colours
Walls, slabs, doors, glazing, frames and bars, stair flights and stair landings, ground slabs and
railings SHALL carry `IfcStyledItem` surface colours. The colours only help tell elements apart and
have no building meaning. The stair, ground and railing colours SHALL each be at least 0.02 away in
RGB distance from every other entry in `STYLES`, so the viewer's `styleOf` recognises them as
themselves rather than as a wall or a slab and patching their upward faces.

#### Scenario: Viewer colours
- **WHEN** the IFC is opened in any viewer
- **THEN** walls, slabs, doors and glazing appear in distinct colours

#### Scenario: Stair colours
- **WHEN** the IFC is opened in any viewer
- **THEN** stair flights and landings appear in a colour distinct from walls, slabs, doors and glazing

#### Scenario: Stair material is not recognised as a wall or slab
- **WHEN** the viewer's plan style looks for the wall and slab colours among a stair's material
- **THEN** it finds neither, so the classifier leaves the stair material alone instead of painting its tops charcoal or discarding them (the readability recolour is a separate shader, see `ifc-viewer`)

#### Scenario: Railing colour
- **WHEN** the IFC is opened in any viewer
- **THEN** railings appear in a colour distinct from walls, slabs, doors, glazing, stairs and ground

#### Scenario: Railing material is not recognised as a wall or slab
- **WHEN** the viewer's plan style looks for the wall and slab colours among a railing's material
- **THEN** it finds neither, so the classifier leaves the railing material alone

## ADDED Requirements

### Requirement: Railings
A railing SHALL be an `IfcRailing` contained in its storey. Its `PredefinedType` SHALL be
`HANDRAIL` when its base offsets differ and `GUARDRAIL` when they are equal. Its body SHALL be a
top rail swept along the run at `height` above the walking surface, plus posts from that surface to
the rail, all styled with the railing colour.

#### Scenario: Sloped handrail
- **WHEN** a railing's end base is above its start base
- **THEN** its `IfcRailing` has `PredefinedType` `HANDRAIL` and its rail rises from start to end

#### Scenario: Level guardrail
- **WHEN** a railing's base offsets are equal
- **THEN** its `IfcRailing` has `PredefinedType` `GUARDRAIL` and its rail is level

#### Scenario: Rail and posts
- **WHEN** a railing is 2000 mm long with a 900 mm height
- **THEN** its body contains one top rail and posts at both ends and at intervals no greater than 1200 mm, in the railing display colour
