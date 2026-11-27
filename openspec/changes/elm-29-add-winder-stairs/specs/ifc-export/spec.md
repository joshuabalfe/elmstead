# Spec Delta

## MODIFIED Requirements

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

### Requirement: Winding stair type

A stair whose first segment is a winder SHALL have the `IfcStair` `PredefinedType`
`QUARTER_WINDING_STAIR` when the winder turns through 90°, within 1°, and `NOTDEFINED` for any other
angle. This replaces the rule from the turning angle between flights, which has no angle to measure
when a stair has one flight.

#### Scenario: Quarter winding stair

- **WHEN** a stair starts with a winder that turns through 90°, then has a flight
- **THEN** its `IfcStair` has `PredefinedType` `QUARTER_WINDING_STAIR`

#### Scenario: Winding stair turning through another angle

- **WHEN** a stair starts with a winder that turns through 120°
- **THEN** its `IfcStair` has `PredefinedType` `NOTDEFINED`

#### Scenario: Winder turn within tolerance

- **WHEN** a winder's outline turns through 90.4° because its points are whole millimetres
- **THEN** its `IfcStair` has `PredefinedType` `QUARTER_WINDING_STAIR`
