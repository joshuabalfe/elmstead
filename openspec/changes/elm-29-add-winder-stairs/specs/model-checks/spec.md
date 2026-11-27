# Spec Delta

## MODIFIED Requirements

### Requirement: Unique ids across the model

Every id-bearing node SHALL have an id unique across the project, site, building, storeys, walls,
openings, slabs, rooms, stairs, stair flights, stair landings, stair winders, railings and
components. A duplicate SHALL be an ERROR against that id whose message names both kinds involved.

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

#### Scenario: Winder and flight share an id

- **WHEN** a stair winder and a stair flight have the same id
- **THEN** the checks report an ERROR against that id saying it is used by a stair flight and a stair winder

#### Scenario: Railing and wall share an id

- **WHEN** a railing and a wall have the same id
- **THEN** the checks report an ERROR against that id saying it is used by a wall and a railing

### Requirement: Stair segments alternate

A stair SHALL start with a flight or a winder and SHALL have no two adjacent landings. A winder
SHALL be the first segment and SHALL be followed by a flight. A stair SHALL end with a flight, or
with a top landing one riser below the storey it climbs to. Each flight SHALL have a non-zero plan
run. A violation SHALL be an ERROR against the stair. The schema already rejects a flight or winder
with fewer than two risers, so the checks do not repeat that rule.

#### Scenario: Starts with a landing

- **WHEN** a stair's first segment is a landing
- **THEN** the checks report an ERROR against the stair

#### Scenario: Ends with a top landing

- **WHEN** a stair's last segment is a landing whose boundary meets the last flight's end
- **THEN** the checks report no error

#### Scenario: Adjacent landings

- **WHEN** a stair has two landing segments in a row
- **THEN** the checks report an ERROR against the stair

#### Scenario: Zero-length flight

- **WHEN** a flight's start and end points are the same
- **THEN** the checks report an ERROR against the stair

#### Scenario: Starts with a winder

- **WHEN** a stair's first segment is a winder and its second is a flight
- **THEN** the checks report no error for the segment order

#### Scenario: Winder after a landing

- **WHEN** a winder is the third segment of a stair, after a flight and a landing
- **THEN** the checks report an ERROR against the stair

#### Scenario: Winder is the last segment

- **WHEN** a stair's last segment is a winder
- **THEN** the checks report an ERROR against the stair

## ADDED Requirements

### Requirement: Winder outline and pivot

A winder's outline SHALL have at least three distinct points, SHALL be convex and SHALL NOT cross
itself. Its `pivot` SHALL be a point of the outline and its `entry` an adjacent point, so the other
point beside the pivot is its exit. A violation SHALL be an ERROR against the winder.

#### Scenario: Pivot off the outline

- **WHEN** a winder's pivot is not one of its outline's points
- **THEN** the checks report an ERROR against the winder

#### Scenario: Entry not beside the pivot

- **WHEN** a winder's entry is an outline point that is not next to its pivot
- **THEN** the checks report an ERROR against the winder

#### Scenario: Concave outline

- **WHEN** a winder's outline has a reflex corner
- **THEN** the checks report an ERROR against the winder

#### Scenario: Valid square winder

- **WHEN** a winder's outline is a square, its pivot is one corner and its entry is a neighbouring corner
- **THEN** the checks report no error for the winder

### Requirement: Winders meet their flight

The flight after a winder SHALL start on the winder's exit edge, the outline's edge from its pivot to
its exit point, within 1 mm. A flight that does not SHALL be an ERROR against the winder.

#### Scenario: Flight misses the exit edge

- **WHEN** the flight after a winder starts 100 mm from the winder's exit edge
- **THEN** the checks report an ERROR against the winder

#### Scenario: Flight starts on the exit edge

- **WHEN** the flight after a winder starts at the middle of the winder's exit edge
- **THEN** the checks report no ERROR for the winder
