# Spec Delta

## MODIFIED Requirements

### Requirement: Walls
A wall SHALL be straight, from `start` to `end`, with a `justification` of `centre`, `left` or
`right` relative to that line, looking from start to end. Its top SHALL be either a flat `height` or
a `profile` top edge, exactly one of the two.

#### Scenario: Unknown justification
- **WHEN** a wall has `justification: "middle"`
- **THEN** schema validation fails

#### Scenario: Flat wall
- **WHEN** a wall has a `height` and no `profile`
- **THEN** schema validation passes

#### Scenario: Pitched wall
- **WHEN** a wall has a `profile` and no `height`
- **THEN** schema validation passes

#### Scenario: Both height and profile
- **WHEN** a wall has both a `height` and a `profile`
- **THEN** schema validation fails

#### Scenario: Neither height nor profile
- **WHEN** a wall has neither a `height` nor a `profile`
- **THEN** schema validation fails

## ADDED Requirements

### Requirement: Pitched wall top edge
A wall's `profile` SHALL be an open polyline of at least two `{ along, up }` points giving its top
edge from the wall's start to its end, measured up from the storey elevation. `along` SHALL be a
non-negative integer strictly increasing along the edge; `up` SHALL be a non-negative integer, and
the profile SHALL rise above the floor somewhere (at least one `up` greater than 0).

#### Scenario: Gable top edge
- **WHEN** a wall's profile is `{along: 0, up: 1200}`, `{along: 4512, up: 2600}`, `{along: 9025, up: 1200}`
- **THEN** schema validation passes

#### Scenario: Profile with one point
- **WHEN** a wall's `profile` has a single point
- **THEN** schema validation fails

#### Scenario: Along not increasing
- **WHEN** a wall's profile has two points with equal `along`
- **THEN** schema validation fails

#### Scenario: Fractional up
- **WHEN** a profile point's `up` is `1200.5`
- **THEN** schema validation fails

#### Scenario: Gable running to the floor
- **WHEN** a wall's profile is `{along: 0, up: 0}`, `{along: 2000, up: 3200}`, `{along: 4000, up: 0}`
- **THEN** schema validation passes

#### Scenario: Profile that never rises
- **WHEN** every point of a wall's profile has `up: 0`
- **THEN** schema validation fails
