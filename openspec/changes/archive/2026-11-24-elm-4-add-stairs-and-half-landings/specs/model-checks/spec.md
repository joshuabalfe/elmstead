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

## MODIFIED Requirements

### Requirement: Unique ids across the model
Every id-bearing node SHALL have an id unique across the project, site, building, storeys, walls,
openings, slabs, rooms, stairs, stair flights, stair landings and components. A duplicate SHALL be
an ERROR against that id whose message names both kinds involved.

#### Scenario: Element and component share an id
- **WHEN** a window component and a wall have the same id
- **THEN** the checks report an ERROR against that id saying it is used by a wall and a window component

#### Scenario: Duplicate room ids
- **WHEN** two rooms on one storey have the same id
- **THEN** the checks report an ERROR against that id saying it is used by two rooms, instead of writing IFC with duplicate GlobalIds

#### Scenario: Duplicate component ids
- **WHEN** a door component and a window component share an id
- **THEN** the checks report an ERROR "component id is used twice" against that id

#### Scenario: Flight and wall share an id
- **WHEN** a stair flight and a wall have the same id
- **THEN** the checks report an ERROR against that id saying it is used by a wall and a stair flight

#### Scenario: Duplicate landing ids
- **WHEN** two stair landings have the same id
- **THEN** the checks report an ERROR against that id saying it is used by two stair landings

### Requirement: Outlines are simple polygons
Every room, slab and stair landing outline SHALL have at least three distinct points, SHALL NOT
repeat any point, SHALL NOT repeat the first point at the end, SHALL have non-zero area and SHALL
NOT self-intersect. Edges SHALL NOT cross, touch a non-adjacent edge or overlap collinearly, and
adjacent edges SHALL NOT double back over each other. A violation SHALL be an ERROR against the
outline's element.

#### Scenario: Self-intersecting room
- **WHEN** a room outline crosses itself
- **THEN** the checks report an ERROR against the room

#### Scenario: Repeated point
- **WHEN** a slab outline repeats a point, including at a non-adjacent position
- **THEN** the checks report an ERROR against the slab

#### Scenario: Vertex on a non-adjacent edge
- **WHEN** an outline has a vertex lying on an edge it is not adjacent to
- **THEN** the checks report an ERROR against the element

#### Scenario: Collinear overlapping edges
- **WHEN** two non-adjacent edges of an outline overlap along the same line
- **THEN** the checks report an ERROR against the element

#### Scenario: Adjacent edges double back
- **WHEN** an outline returns along an edge it has just traversed
- **THEN** the checks report an ERROR against the element

#### Scenario: Self-intersecting landing
- **WHEN** a stair landing outline crosses itself
- **THEN** the checks report an ERROR against the landing

#### Scenario: Repeated point in a landing
- **WHEN** a stair landing outline repeats a point
- **THEN** the checks report an ERROR against the landing