# model-checks Specification

## Purpose
Cross-element rules that the schema cannot express, run on the validated model before any output is
written (`src/checks/`). So far these cover door and window components, and doorways.

## Requirements

### Requirement: Openings reference a component of their own kind
An opening's `componentId`, when present, SHALL name a component of the same kind: doors name door
components and windows name window components. Openings without a `componentId` SHALL be allowed.

#### Scenario: Unknown component
- **WHEN** a window's `componentId` is not in `components`
- **THEN** an ERROR "componentId … is not in components" is reported against the window

#### Scenario: Wrong kind
- **WHEN** a door's `componentId` names a window component
- **THEN** an ERROR "componentId … is a window component" is reported against the door

### Requirement: A doorway has no leaf
A door with `doorway: true` SHALL NOT have a `componentId` or a `swing`, because it has no leaf or handing.

#### Scenario: Doorway with a swing
- **WHEN** a door has `doorway: true` and a `swing`
- **THEN** an ERROR "a doorway has no component or swing" is reported against the door

### Requirement: Windows leave room for glass
For each window with a design, twice the frame width plus the glazing bars SHALL be less than the
window's width across and its height up. The bars count as (panes − 1) × bar width in each
direction.

#### Scenario: Frame and bars too wide
- **WHEN** a 300 mm wide window uses a design with a 100 mm frame and three columns of panes with 60 mm bars
- **THEN** an ERROR against the window says the frame and bars leave no glass across

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
length, and its sill height plus its height SHALL NOT exceed the wall height. A window with a
reveal SHALL also fit at its splayed face, where it is wider at both jambs.

#### Scenario: Opening past the wall end
- **WHEN** an opening's `offsetAlongWall` plus `width` is greater than the wall length
- **THEN** the checks report an ERROR against the opening

#### Scenario: Opening above the wall top
- **WHEN** an opening's `sillHeight` plus `height` is greater than the wall height
- **THEN** the checks report an ERROR against the opening

#### Scenario: Reveal past the wall start
- **WHEN** a window with a 45° reveal in a 400 mm wall has an `offsetAlongWall` of 100
- **THEN** the checks report an ERROR against the window that it is 100 mm past the wall start

### Requirement: Openings on one wall do not overlap
Two openings on the same wall SHALL NOT overlap in both their plan outline and their vertical
extent. A window's plan outline SHALL include its splayed reveal. An overlap SHALL be an ERROR
against both openings.

#### Scenario: Two openings cut the same wall volume
- **WHEN** two windows on one wall share part of their width and part of their height range
- **THEN** the checks report an ERROR against both openings

#### Scenario: Reveals overlap at the face
- **WHEN** two windows at the same height are 300 mm apart on a 400 mm wall and both have a 45° reveal on the same face
- **THEN** the checks report an ERROR against both windows, because their 200 mm splays meet at that face

#### Scenario: Reveals on opposite faces
- **WHEN** two windows at the same height are 300 mm apart on a 400 mm wall, one with a 45° reveal on the left face and one on the right
- **THEN** the checks report no overlap, because each 200 mm splay stops short of the other window's square half

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

### Requirement: Railing runs
Each railing SHALL have a non-zero plan run. A zero-length railing SHALL be an ERROR against the
railing.

#### Scenario: Zero-length railing
- **WHEN** a railing's start and end points are the same
- **THEN** the checks report an ERROR against the railing
