## MODIFIED Requirements

### Requirement: Opening points
An opening point SHALL name an opening and `start`, `end` or `centre`: the jamb nearest the wall's
start, the far jamb, or half way between. Without a face it SHALL lie on the host wall's start–end
line; with a face, on that face of the host wall. On the face a window's reveal splays to, `start`
and `end` SHALL be the splayed jambs, where the reveal meets the face.

#### Scenario: Window jamb on a face
- **WHEN** a point names the `start` of a window on the `left` face of its wall
- **THEN** it resolves to the wall's left face at `offsetAlongWall` from the wall's start

#### Scenario: Window width
- **WHEN** a constraint runs from a window's `start` to its `end`, measured along its wall
- **THEN** the measured distance is the window's width

#### Scenario: Splayed jamb
- **WHEN** a 1200 mm window in a 400 mm wall has a 45° reveal on the left face, and a constraint runs from its `start` to its `end` on the `left` face, measured along its wall
- **THEN** the measured distance is 1600 mm

#### Scenario: Square face of a splayed window
- **WHEN** the same constraint names the `right` face
- **THEN** the measured distance is 1200 mm
