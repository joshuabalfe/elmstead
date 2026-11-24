# Spec Delta

## ADDED Requirements

### Requirement: Stair container and flights
A stair SHALL be an `IfcStair` contained in its storey, with a `PredefinedType` derived from the
turning angle between consecutive flights' plan directions. Each flight SHALL be an `IfcStairFlight`
with `NumberOfRisers`, `NumberOfTreads` (risers minus one), `RiserHeight`, `TreadLength` and a stepped
body. These are the IFC4 names: IFC2x3 called them `ShapeType` and `NumberOfRiser`, and IFC4 rejects
both spellings.

#### Scenario: Half-turn stair
- **WHEN** a stair has two flights separated by a 180° landing
- **THEN** its `IfcStair` has `PredefinedType` `HALF_TURN_STAIR` and one `IfcStairFlight` per flight

#### Scenario: Straight stair
- **WHEN** a stair has one straight flight and no landing
- **THEN** its `IfcStair` has `PredefinedType` `STRAIGHT_RUN_STAIR`

#### Scenario: Two flights that do not turn
- **WHEN** a stair's two flights run in the same direction, with a landing between them
- **THEN** its `IfcStair` has `PredefinedType` `TWO_STRAIGHT_RUN_STAIR`

#### Scenario: Quarter turn
- **WHEN** a stair's two flights turn through 90°
- **THEN** its `IfcStair` has `PredefinedType` `QUARTER_TURN_STAIR`

#### Scenario: Turning angle matches no arrangement
- **WHEN** a stair's two flights turn through 45°
- **THEN** its `IfcStair` has `PredefinedType` `NOTDEFINED`

#### Scenario: Flight attributes
- **WHEN** a flight has 8 risers and a 1865 mm run
- **THEN** its `IfcStairFlight` has `NumberOfRisers` 8, `NumberOfTreads` 7, and derived `RiserHeight` and `TreadLength`

### Requirement: Stair landings
Each landing SHALL be an `IfcSlab` with `PredefinedType` `LANDING` and a body extruded downwards
from the landing level by its thickness.

#### Scenario: Half landing
- **WHEN** a stair has a landing between two flights
- **THEN** the IFC has an `IfcSlab` with `PredefinedType` `LANDING` at the cumulative height of the lower flight

### Requirement: Stair decomposition
Flights and landings SHALL be aggregated under their `IfcStair` with `IfcRelAggregates`. The
`IfcStair` itself SHALL have no body, so the stair geometry is counted once through its parts.

#### Scenario: One aggregate
- **WHEN** a stair has two flights and one landing
- **THEN** one `IfcRelAggregates` links the `IfcStair` to both flights and the landing, and the `IfcStair` has no `Representation`

## MODIFIED Requirements

### Requirement: Display colours
Walls, slabs, doors, glazing, frames and bars, stair flights and stair landings SHALL carry
`IfcStyledItem` surface colours. The colours only help tell elements apart and have no building
meaning. The stair colour SHALL be at least 0.02 away in RGB distance from every other entry in
`STYLES`, so the viewer's `styleOf` does not recognise a stair material as a wall or a slab and
patch its upward faces.

#### Scenario: Viewer colours
- **WHEN** the IFC is opened in any viewer
- **THEN** walls, slabs, doors and glazing appear in distinct colours

#### Scenario: Stair colours
- **WHEN** the IFC is opened in any viewer
- **THEN** stair flights and landings appear in a colour distinct from walls, slabs, doors and glazing

#### Scenario: Stair material is not recognised as a wall or slab
- **WHEN** the viewer's plan style looks for the wall and slab colours among a stair's material
- **THEN** it finds neither, so the classifier leaves the stair material alone instead of painting its tops charcoal or discarding them (the readability recolour is a separate shader, see `ifc-viewer`)