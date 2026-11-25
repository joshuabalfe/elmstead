# Spec Delta

## ADDED Requirements

### Requirement: Railing volumes
The round-trip SHALL expect a railing's volume to be its 3D length × 50 mm × 40 mm plus each post's
40 mm × 40 mm × height. A post runs from the walking surface to the top of the rail, so the
post/rail overlap is counted in both the expected and mesh volumes. This extends the *Expected
volumes* list, which keeps the wall, slab, door and window rules — including a window reveal's
splay — as they are.

#### Scenario: Railing volume
- **WHEN** a railing's IFC mesh volume differs from its rail plus post volumes
- **THEN** build reports an ERROR against that railing

#### Scenario: Railing parts add up
- **WHEN** the round-trip lists what a railing contributes
- **THEN** the top rail and every post are counted, and no extra body is expected
