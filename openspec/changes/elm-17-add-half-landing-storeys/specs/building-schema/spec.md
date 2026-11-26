# Spec Delta

## ADDED Requirements

### Requirement: Half-landing storey
A storey MAY represent a half landing between two floors: its elevation MAY lie between theirs, it
MAY have no rooms, and its slab MAY be the landing. A stair from the floor below MAY climb to it and
another MAY climb on from it to the floor above. Walls and openings at the landing's level MAY stand
on it. The schema SHALL validate such a storey like any other.

#### Scenario: Stair split at a half-landing storey
- **WHEN** a ground storey at 0 mm has a stair to a half-landing storey at 1641 mm, which has a stair to a first floor at 3100 mm
- **THEN** schema validation and the model checks pass

#### Scenario: Half-landing storey without rooms
- **WHEN** a half-landing storey has a landing slab, walls and a stair, and an empty `rooms` array
- **THEN** schema validation passes

#### Scenario: Split-level walls stand on the half landing
- **WHEN** a wall stands on a half-landing storey at 1641 mm with a height of 2909 mm
- **THEN** its base is at 1641 mm and its top at 4550 mm, and it does not reach down to the floor below

#### Scenario: Landing segment still available
- **WHEN** a stair has flight, landing and flight segments and climbs straight from one floor to the next
- **THEN** schema validation passes, and the landing needs no storey of its own
