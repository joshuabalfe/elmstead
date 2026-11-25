# Spec Delta

## MODIFIED Requirements

### Requirement: Openings fit their wall
An opening SHALL fit wholly within its wall: the offset plus its width SHALL NOT exceed the wall
length, and its sill height plus its height SHALL NOT exceed the wall's top over the opening's whole
width — the flat `height`, or for a pitched wall the lowest point of its `profile` top edge across
that width. A window with a reveal SHALL also fit at its splayed face, where it is wider at both jambs.

#### Scenario: Opening past the wall end
- **WHEN** an opening's `offsetAlongWall` plus `width` is greater than the wall length
- **THEN** the checks report an ERROR against the opening

#### Scenario: Opening above the wall top
- **WHEN** an opening's `sillHeight` plus `height` is greater than the wall height
- **THEN** the checks report an ERROR against the opening

#### Scenario: Reveal past the wall start
- **WHEN** a window with a 45° reveal in a 400 mm wall has an `offsetAlongWall` of 100
- **THEN** the checks report an ERROR against the window that it is 100 mm past the wall start

#### Scenario: Opening above a pitched top near the eaves
- **WHEN** a window's sill height plus height exceeds the lowest point of a pitched wall's top edge across the window's width
- **THEN** the checks report an ERROR against the window

#### Scenario: Opening fits under a pitched top
- **WHEN** a window's sill height plus height is at or below the lowest point of a pitched wall's top edge across the window's whole width
- **THEN** the checks report no ERROR for that window

## ADDED Requirements

### Requirement: Pitched profile spans the wall
A pitched wall's `profile` top edge SHALL span the wall: its first point's `along` SHALL be 0 and its
last point's `along` SHALL equal the wall's length. A profile that stops short of either end SHALL be
an ERROR against the wall.

#### Scenario: Profile stops short of the wall end
- **WHEN** a wall's profile last `along` is less than the wall length
- **THEN** the checks report an ERROR against the wall

#### Scenario: Profile does not start at the wall start
- **WHEN** a wall's profile first `along` is greater than 0
- **THEN** the checks report an ERROR against the wall

#### Scenario: Profile spans the wall
- **WHEN** a wall's profile runs from `along: 0` to `along` equal to the wall length
- **THEN** the checks report no ERROR for that wall
