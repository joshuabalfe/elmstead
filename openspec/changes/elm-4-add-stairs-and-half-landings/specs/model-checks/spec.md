# Spec Delta

## ADDED Requirements

### Requirement: Stairs join two storeys
Each stair's `toStoreyId` SHALL name a storey in the model other than its own, with a higher
elevation. A missing, self-referencing or lower target SHALL be an ERROR against the stair.

#### Scenario: Unknown target storey
- **WHEN** a stair names a `toStoreyId` that is not in the model
- **THEN** the checks report an ERROR against the stair

#### Scenario: Target is the same storey
- **WHEN** a stair's `toStoreyId` is its containing storey
- **THEN** the checks report an ERROR against the stair

#### Scenario: Target is below
- **WHEN** a stair's target storey has a lower elevation than its containing storey
- **THEN** the checks report an ERROR against the stair

### Requirement: Stair segments alternate
A stair SHALL start and end with a flight and SHALL have no two adjacent landings. Each flight SHALL
have a non-zero plan run and at least two risers. A violation SHALL be an ERROR against the stair.

#### Scenario: Starts with a landing
- **WHEN** a stair's first segment is a landing
- **THEN** the checks report an ERROR against the stair

#### Scenario: Adjacent landings
- **WHEN** a stair has two landing segments in a row
- **THEN** the checks report an ERROR against the stair

#### Scenario: Zero-length flight
- **WHEN** a flight's start and end points are the same
- **THEN** the checks report an ERROR against the stair

### Requirement: Stair landings connect their flights
Each landing SHALL meet the previous flight's end and the next flight's start: both points SHALL lie
on the landing outline's boundary within 1 mm. A landing that does not meet its flights SHALL be an
ERROR against the landing.

#### Scenario: Flight misses the landing
- **WHEN** a flight ends 100 mm away from the next landing's boundary
- **THEN** the checks report an ERROR against the landing

#### Scenario: Flights meet the landing
- **WHEN** the previous flight's end and the next flight's start both lie on the landing boundary
- **THEN** the checks report no ERROR for that landing

### Requirement: Stair ids are unique
Stair, flight and landing ids SHALL be unique across the model, alongside every other element and
component id. A duplicate SHALL be an ERROR against that id.

#### Scenario: Flight and wall share an id
- **WHEN** a stair flight and a wall have the same id
- **THEN** the checks report an ERROR against that id naming both kinds

#### Scenario: Duplicate landing ids
- **WHEN** two stair landings have the same id
- **THEN** the checks report an ERROR against that id