# Spec Delta

## MODIFIED Requirements

### Requirement: Unique ids across the model
Every id-bearing node SHALL have an id unique across the project, site, building, storeys, walls,
openings, slabs, rooms, stairs, stair flights, stair landings, railings and components. A duplicate
SHALL be an ERROR against that id whose message names both kinds involved.

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

#### Scenario: Railing and wall share an id
- **WHEN** a railing and a wall have the same id
- **THEN** the checks report an ERROR against that id saying it is used by a wall and a railing

## ADDED Requirements

### Requirement: Railing runs
Each railing SHALL have a non-zero plan run. A zero-length railing SHALL be an ERROR against the
railing.

#### Scenario: Zero-length railing
- **WHEN** a railing's start and end points are the same
- **THEN** the checks report an ERROR against the railing
