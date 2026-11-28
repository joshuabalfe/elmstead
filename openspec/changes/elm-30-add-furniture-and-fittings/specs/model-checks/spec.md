# Spec Delta

## MODIFIED Requirements

### Requirement: Unique ids across the model

Every id-bearing node SHALL have an id unique across the project, site, building, storeys, walls,
openings, slabs, rooms, stairs, stair flights, stair landings, railings, furnishings and
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

#### Scenario: Railing and wall share an id

- **WHEN** a railing and a wall have the same id
- **THEN** the checks report an ERROR against that id saying it is used by a wall and a railing

#### Scenario: Furnishing and room share an id

- **WHEN** a furnishing and a room have the same id
- **THEN** the checks report an ERROR against that id saying it is used by a room and a furnishing

## ADDED Requirements

### Requirement: Furnishings stay out of walls

A furnishing's footprint SHALL NOT overlap the body of any wall on its storey. A furnishing that
only touches a wall face SHALL be allowed. An overlap SHALL be an ERROR against the furnishing that
names the wall.

#### Scenario: Bed through a wall

- **WHEN** a bed's footprint extends 100 mm into a wall's body
- **THEN** the checks report an ERROR against the bed naming that wall

#### Scenario: Basin against a wall

- **WHEN** a wash basin's back edge lies exactly on a wall's face
- **THEN** the checks report nothing for it

#### Scenario: Rotated furnishing

- **WHEN** a sofa rotated 30 degrees has a corner inside a wall's body
- **THEN** the checks report an ERROR against the sofa naming that wall

#### Scenario: Furnishing beside a wall on another storey

- **WHEN** a furnishing's footprint overlaps in plan a wall that belongs to a different storey
- **THEN** the checks report nothing for it
