# Spec Delta

## ADDED Requirements

### Requirement: Stairs join two storeys
Each stair's `toStoreyId` SHALL name the next storey above its own: the storey with the lowest
elevation that is still higher than the containing storey's. A missing, self-referencing, lower or
skipped target SHALL be an ERROR against the stair. Requiring the next storey up keeps the derived
riser height tied to one storey's rise, which no other check bounds.

#### Scenario: Unknown target storey
- **WHEN** a stair names a `toStoreyId` that is not in the model
- **THEN** the checks report an ERROR against the stair

#### Scenario: Target is the same storey
- **WHEN** a stair's `toStoreyId` is its containing storey
- **THEN** the checks report an ERROR against the stair

#### Scenario: Target is below
- **WHEN** a stair's target storey has a lower elevation than its containing storey
- **THEN** the checks report an ERROR against the stair

#### Scenario: Target skips a storey
- **WHEN** a stair on the ground storey names the second storey and a first storey lies between them
- **THEN** the checks report an ERROR against the stair

### Requirement: Stair segments alternate
A stair SHALL start and end with a flight and SHALL have no two adjacent landings. Each flight SHALL
have a non-zero plan run. A violation SHALL be an ERROR against the stair. The schema already
rejects a flight with fewer than two risers, so the checks do not repeat that rule.

#### Scenario: Starts with a landing
- **WHEN** a stair's first segment is a landing
- **THEN** the checks report an ERROR against the stair

#### Scenario: Adjacent landings
- **WHEN** a stair has two landing segments in a row
- **THEN** the checks report an ERROR against the stair

#### Scenario: Zero-length flight
- **WHEN** a flight's start and end points are the same
- **THEN** the checks report an ERROR against the stair

### Requirement: Stair landing outlines are simple polygons
Every stair landing outline SHALL satisfy the same polygon rules as a room or slab outline: at least
three distinct points, no repeated point, non-zero area, no self-intersection, no edge crossing,
touching a non-adjacent edge or overlapping collinearly, and no doubling back between adjacent
edges. A violation SHALL be an ERROR against the landing. Without this the outline check skips
landings, and a self-intersecting one reaches the IFC extrusion and the boundary test below.

#### Scenario: Self-intersecting landing
- **WHEN** a stair landing outline crosses itself
- **THEN** the checks report an ERROR against the landing

#### Scenario: Repeated point in a landing
- **WHEN** a stair landing outline repeats a point
- **THEN** the checks report an ERROR against the landing

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

### Requirement: Stair ids join the model-wide id table
Stair, flight and landing ids SHALL join the model-wide id table that ELM-1's *Unique ids across the
model* requirement defines, so they are unique alongside every other element and component id. A
duplicate SHALL be an ERROR against that id, whose message names both kinds involved. This extends
that rule to three more id-bearing nodes rather than restating it; ELM-1 is implemented but not yet
archived, so its requirement reaches `openspec/specs/` when ELM-1 is synced.

#### Scenario: Flight and wall share an id
- **WHEN** a stair flight and a wall have the same id
- **THEN** the checks report an ERROR against that id naming both kinds

#### Scenario: Duplicate landing ids
- **WHEN** two stair landings have the same id
- **THEN** the checks report an ERROR against that id