# Spec Delta

## MODIFIED Requirements

### Requirement: Fixed set of element types
The schema SHALL describe a building as one project, one site, one building, optional door and
window components, and at least one storey. Each storey SHALL hold only walls, openings (doors and
windows), slabs, rooms, optional stairs and optional railings. The schema SHALL carry
`schemaVersion: 1`.

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

#### Scenario: Storey with railings
- **WHEN** a storey has a valid `railings` array
- **THEN** schema validation passes

#### Scenario: Storey without railings
- **WHEN** a storey omits `railings`
- **THEN** schema validation passes

## ADDED Requirements

### Requirement: Railing shape
A railing SHALL have an id, an optional name, `start` and `end` points, a positive `height`, and
optional non-negative `startBase` and `endBase` offsets from the storey floor. It SHALL be a
straight run from `start` to `end`; `height` is the top rail above the walking surface, and the
bases are that surface at each end, so equal bases make a level guard and different bases a sloped
handrail. A railing SHALL NOT store any other elevation.

#### Scenario: Level railing
- **WHEN** a railing has equal `startBase` and `endBase`
- **THEN** schema validation passes and the run is level

#### Scenario: Sloped railing
- **WHEN** a railing's `endBase` is 600 mm above its `startBase`
- **THEN** schema validation passes and its top rail slopes upwards from start to end

#### Scenario: Negative base
- **WHEN** a railing's `startBase` is `-100`
- **THEN** schema validation fails

#### Scenario: Zero height
- **WHEN** a railing's `height` is `0`
- **THEN** schema validation fails
