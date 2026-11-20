# Spec Delta

## ADDED Requirements

### Requirement: Stair container and flights
A stair SHALL be an `IfcStair` contained in its storey, with a `ShapeType` that reflects its flight
arrangement. Each flight SHALL be an `IfcStairFlight` with `NumberOfRiser`, `NumberOfTreads`
(risers minus one), `RiserHeight`, `TreadLength` and a stepped body.

#### Scenario: Half-turn stair
- **WHEN** a stair has two flights separated by a 180° landing
- **THEN** its `IfcStair` uses `HALF_TURN_STAIR` and has one `IfcStairFlight` per flight

#### Scenario: Straight stair
- **WHEN** a stair has one straight flight and no landing
- **THEN** its `IfcStair` uses `STRAIGHT_RUN_STAIR`

#### Scenario: Flight attributes
- **WHEN** a flight has 8 risers and a 1865 mm run
- **THEN** its `IfcStairFlight` has `NumberOfRiser` 8, `NumberOfTreads` 7, and derived `RiserHeight` and `TreadLength`

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

### Requirement: Stair display colours
Stair flights and landings SHALL carry `IfcStyledItem` surface colours so they are distinguishable in
any IFC viewer. The colours have no building meaning.

#### Scenario: Viewer colours
- **WHEN** the IFC is opened in any viewer
- **THEN** stair flights and landings appear in a colour distinct from walls, slabs, doors and glazing