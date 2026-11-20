# Spec Delta

## ADDED Requirements

### Requirement: Unique ids across the model
Every id-bearing node SHALL have an id unique across the project, site, building, storeys, walls,
openings, slabs, rooms and components. A duplicate SHALL be an ERROR against that id whose message
names both kinds involved.

#### Scenario: Element and component share an id
- **WHEN** a window component and a wall have the same id
- **THEN** the checks report an ERROR against that id saying it is used by a wall and a window component

#### Scenario: Duplicate room ids
- **WHEN** two rooms on one storey have the same id
- **THEN** the checks report an ERROR against that id saying it is used by two rooms, instead of writing IFC with duplicate GlobalIds

#### Scenario: Duplicate component ids
- **WHEN** a door component and a window component share an id
- **THEN** the checks report an ERROR "component id is used twice" against that id

### Requirement: Openings belong to a wall on their storey
Each opening's `wallId` SHALL name a wall on the same storey. A zero-length wall SHALL be an ERROR.

#### Scenario: Missing host wall
- **WHEN** an opening names a wall that is not on its storey
- **THEN** the checks report an ERROR against the opening

#### Scenario: Zero-length wall
- **WHEN** a wall's start and end points are the same
- **THEN** the checks report an ERROR against the wall

### Requirement: Openings fit their wall
An opening SHALL fit wholly within its wall: the offset plus its width SHALL NOT exceed the wall
length, and its sill height plus its height SHALL NOT exceed the wall height.

#### Scenario: Opening past the wall end
- **WHEN** an opening's `offsetAlongWall` plus `width` is greater than the wall length
- **THEN** the checks report an ERROR against the opening

#### Scenario: Opening above the wall top
- **WHEN** an opening's `sillHeight` plus `height` is greater than the wall height
- **THEN** the checks report an ERROR against the opening

### Requirement: Openings on one wall do not overlap
Two openings on the same wall SHALL NOT overlap in both their extent along the wall and their
vertical extent. An overlap SHALL be an ERROR against both openings.

#### Scenario: Two openings cut the same wall volume
- **WHEN** two windows on one wall share part of their width and part of their height range
- **THEN** the checks report an ERROR against both openings

### Requirement: Outlines are simple polygons
Every room and slab outline SHALL have at least three distinct points, SHALL NOT repeat any point,
SHALL NOT repeat the first point at the end, SHALL have non-zero area and SHALL NOT self-intersect.
Edges SHALL NOT cross, touch a non-adjacent edge or overlap collinearly, and adjacent edges SHALL
NOT double back over each other. A violation SHALL be an ERROR against the outline's element.

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

## MODIFIED Requirements

### Requirement: Checks gate the build
`build` SHALL run the model checks before writing any output and SHALL write nothing if they report
an ERROR. `render` SHALL run the model checks before writing any plan and SHALL write nothing if
they report an ERROR.

#### Scenario: Failing check
- **WHEN** any model check reports an ERROR
- **THEN** no file in `out/` is written or changed by that command

#### Scenario: Render refuses an invalid model
- **WHEN** `render` runs on a model with a check ERROR
- **THEN** no plan or snapshot is written and the command exits 1

## REMOVED Requirements

### Requirement: Unique component ids