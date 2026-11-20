## MODIFIED Requirements

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
