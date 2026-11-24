# Spec Delta

## MODIFIED Requirements

### Requirement: Fixed set of element types
The schema SHALL describe a building as one project, one site, one building, optional door and
window components, and at least one storey. Each storey SHALL hold only walls, openings (doors and
windows), slabs, rooms and optional stairs. The schema SHALL carry `schemaVersion: 1`.

#### Scenario: Model with no storeys
- **WHEN** a model has an empty `storeys` array
- **THEN** schema validation fails

#### Scenario: Unsupported element
- **WHEN** a storey contains a field such as `roofs` that the schema does not define
- **THEN** schema validation fails

#### Scenario: Storey with a stair
- **WHEN** a storey has a valid `stairs` array
- **THEN** schema validation passes

#### Scenario: Storey without stairs
- **WHEN** a storey omits `stairs`
- **THEN** schema validation passes

### Requirement: Integer millimetre lengths
Every authored length SHALL be an integer number of millimetres. Thickness, height and width of
walls, openings, slabs, stair flights and landings, frames and glazing bars SHALL be positive;
`offsetAlongWall` and `sillHeight` SHALL be non-negative. Angles SHALL be finite numbers of degrees.
Derived lengths, such as a stair's riser height and going, MAY be fractional.

#### Scenario: Fractional length
- **WHEN** a wall's thickness is `200.5`
- **THEN** schema validation fails

#### Scenario: Zero thickness
- **WHEN** a wall's thickness is `0`
- **THEN** schema validation fails

#### Scenario: Fractional derived stair length
- **WHEN** a 3050 mm rise is divided into 16 risers
- **THEN** the derived riser height is 190.625 mm and schema validation of the authored stair passes

## ADDED Requirements

### Requirement: Stair shape
A stair SHALL have an id, an optional name, a `toStoreyId` and one or more segments in bottom-to-top
order. A segment SHALL be a flight or a landing, discriminated by `kind`. A flight SHALL have
`start`, `end`, `width` and an integer `risers` of at least 2. A landing SHALL have an `outline` and
a positive `thickness`.

#### Scenario: Unknown segment kind
- **WHEN** a stair segment has `kind: "winder"`
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

### Requirement: Stair elevations are derived
A stair SHALL NOT store elevations, riser height or going. Its bottom SHALL be its containing
storey's elevation and its top SHALL be the elevation of the storey named by `toStoreyId`.
Intermediate levels SHALL follow from the ordered segments and the flights' riser counts. Going
SHALL be a flight's plan run divided by its risers minus one.

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