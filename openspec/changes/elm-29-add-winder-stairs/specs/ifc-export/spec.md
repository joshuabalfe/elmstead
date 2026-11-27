# Spec Delta

## MODIFIED Requirements

### Requirement: Stair container and flights

A stair SHALL be an `IfcStair` contained in its storey, with a `PredefinedType` derived from the
turning angle between consecutive flights' plan directions, except a stair that starts with a winder.
Each flight SHALL be an `IfcStairFlight` with `NumberOfRisers`, `NumberOfTreads` (risers minus one),
`RiserHeight`, `TreadLength` and a stepped body. These are the IFC4 names: IFC2x3 called them
`ShapeType` and `NumberOfRiser`, and IFC4 rejects both spellings.

#### Scenario: Half-turn stair

- **WHEN** a stair has two flights separated by a 180° landing
- **THEN** its `IfcStair` has `PredefinedType` `HALF_TURN_STAIR` and one `IfcStairFlight` per flight

#### Scenario: Straight stair

- **WHEN** a stair has one straight flight, no landing and no winder
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

### Requirement: Stair decomposition

Flights, landings and winders SHALL be aggregated under their `IfcStair` with `IfcRelAggregates`.
The `IfcStair` itself SHALL have no body, so the stair geometry is counted once through its parts.

#### Scenario: One aggregate

- **WHEN** a stair has two flights and one landing
- **THEN** one `IfcRelAggregates` links the `IfcStair` to both flights and the landing, and the `IfcStair` has no `Representation`

#### Scenario: Winder aggregate

- **WHEN** a stair has a winder and a flight
- **THEN** one `IfcRelAggregates` links the `IfcStair` to both, and the `IfcStair` has no `Representation`

## ADDED Requirements

### Requirement: Stair winders

A winder SHALL be an `IfcStairFlight` with `PredefinedType` `WINDER`, `NumberOfRisers` and
`NumberOfTreads` both equal to its risers, the stair's `RiserHeight` and no `TreadLength`, because its
treads have no single length. Its body SHALL be one solid per tread, in the stair's colour.

#### Scenario: Winder attributes

- **WHEN** a winder has 3 risers
- **THEN** its `IfcStairFlight` has `PredefinedType` `WINDER`, `NumberOfRisers` 3, `NumberOfTreads` 3 and no `TreadLength`

#### Scenario: One solid per tread

- **WHEN** a winder has 3 risers
- **THEN** its body has three solids, the k-th rising k risers above the winder's base

#### Scenario: Winder colour

- **WHEN** a winder is written
- **THEN** it has the same IFC colour as the stair's flights, so the viewer presents it as a stair

#### Scenario: Winder passes IFC validation

- **WHEN** a model with a winder is built
- **THEN** the IfcOpenShell validation, with the IFC4 where-rules, reports no finding against the winder

### Requirement: Winding stair type

A stair whose first segment is a winder SHALL have the `IfcStair` `PredefinedType`
`QUARTER_WINDING_STAIR` when it is that winder and one flight and the winder turns through 90°, within
1°. Any other stair that starts with a winder SHALL be `NOTDEFINED`.

#### Scenario: Quarter winding stair

- **WHEN** a stair is a winder that turns through 90° followed by one flight
- **THEN** its `IfcStair` has `PredefinedType` `QUARTER_WINDING_STAIR`

#### Scenario: Winding stair turning through another angle

- **WHEN** a stair is a winder that turns through 120° followed by one flight
- **THEN** its `IfcStair` has `PredefinedType` `NOTDEFINED`

#### Scenario: Winding stair that goes on to turn again

- **WHEN** a stair is a 90° winder, a flight, a landing and a second flight
- **THEN** its `IfcStair` has `PredefinedType` `NOTDEFINED`

#### Scenario: Turn within tolerance

- **WHEN** a winder's outline turns through 89.5°
- **THEN** a stair of that winder and one flight has `PredefinedType` `QUARTER_WINDING_STAIR`
