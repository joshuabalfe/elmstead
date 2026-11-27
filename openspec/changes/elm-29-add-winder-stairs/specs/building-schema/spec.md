# Spec Delta

## MODIFIED Requirements

### Requirement: Stair shape

A stair SHALL have an id, an optional name, a `toStoreyId` and one or more segments in bottom-to-top
order. A segment SHALL be a flight, a landing or a winder, discriminated by `kind`. A flight SHALL have
`start`, `end`, `width` and an integer `risers` of at least 2. A landing SHALL have an `outline` and
a positive `thickness`. A winder SHALL have an `outline`, a `pivot`, an `entry` and an integer
`risers` of at least 2.

#### Scenario: Unknown segment kind

- **WHEN** a stair segment has `kind: "spiral"`
- **THEN** schema validation fails

#### Scenario: Flight with one riser

- **WHEN** a stair flight has `risers: 1`
- **THEN** schema validation fails

#### Scenario: Landing with two points

- **WHEN** a stair landing outline has two points
- **THEN** schema validation fails

#### Scenario: Valid half-turn stair

- **WHEN** a stair has flight, landing and flight segments in that order
- **THEN** schema validation passes

#### Scenario: Winder with one riser

- **WHEN** a stair winder has `risers: 1`
- **THEN** schema validation fails

#### Scenario: Winder with two points

- **WHEN** a stair winder outline has two points
- **THEN** schema validation fails

#### Scenario: Winder without a pivot

- **WHEN** a stair winder has no `pivot`
- **THEN** schema validation fails

#### Scenario: Valid winding stair

- **WHEN** a stair has a winder segment followed by a flight segment
- **THEN** schema validation passes

### Requirement: Stair elevations are derived

A stair SHALL NOT store elevations, riser height or going. Its bottom SHALL be its containing
storey's elevation and its top SHALL be the elevation of the storey named by `toStoreyId`.
Intermediate levels SHALL follow from the ordered segments and the flights' and winders' riser
counts. Going SHALL be a flight's plan run divided by its risers minus one.

#### Scenario: Half landing height

- **WHEN** a stair rises 3050 mm over two flights of 8 risers each
- **THEN** the riser height is 190.625 mm and the landing is 1525 mm above the lower storey

#### Scenario: Going from the plan run

- **WHEN** a flight has 8 risers and a 1865 mm plan run
- **THEN** its going is 1865/7 mm, about 266.43 mm

#### Scenario: Uneven riser split still reaches the target

- **WHEN** a stair from a storey at 0 to a storey at 3050 mm has flights of 9 and 7 risers with a landing between them
- **THEN** the riser height is 190.625 mm, the landing is 1715.625 mm up, and walking the segments ends at 3050 mm

#### Scenario: Rounding the riser would miss the target

- **WHEN** the derived riser height is rounded to a whole millimetre before the levels are walked
- **THEN** the stair top is 3056 mm, not the target storey's 3050 mm, which is why derived lengths stay fractional

#### Scenario: Winder risers share the rise

- **WHEN** a stair rises 2200 mm over a winder of 3 risers followed by a flight of 8 risers
- **THEN** the riser height is 200 mm, the winder's last tread is 600 mm up, and the flight starts from 600 mm

## ADDED Requirements

### Requirement: Winder treads are derived

A winder's treads SHALL NOT be stored. A winder with N risers SHALL have N treads, one in each of N
sectors that fan out from its `pivot` and divide the angle between its entry and exit edges into
equal parts. Tread k SHALL be at k risers above the winder's base, so the winder's top is at N risers.

#### Scenario: Quarter-turn fan

- **WHEN** a winder with 3 risers turns through 90° about its pivot
- **THEN** it has three treads, with fan lines 30° and 60° from its entry edge, and its last tread is 3 risers up

#### Scenario: Sector containing an outline corner

- **WHEN** a fan line leaves one side of a square winder outline and the next leaves the adjacent side
- **THEN** the tread between them includes the outline's corner, so the treads together cover the outline exactly
