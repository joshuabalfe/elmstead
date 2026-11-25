# Spec Delta

## MODIFIED Requirements

### Requirement: Walls and openings
A wall SHALL be an `IfcWall` (`NOTDEFINED`) with an `Axis` polyline and an extruded `Body`, placed
by its start, direction and justification. Each opening SHALL be an `IfcOpeningElement` that voids
its wall, and its box SHALL extend 10 mm past each wall face. A window with a reveal SHALL be voided
by its plan outline extruded up its height, its splayed jambs continued 10 mm past the face.

#### Scenario: Opening cut
- **WHEN** a wall has a window
- **THEN** an `IfcOpeningElement` voids the wall and the window fills that opening

#### Scenario: Splayed opening cut
- **WHEN** a window has a 45° reveal on its wall's left face
- **THEN** its `IfcOpeningElement` is square from the right face to the middle of the wall and widens at 45° on both jambs to the left face

#### Scenario: Window without a reveal is unchanged
- **WHEN** a window has no reveal
- **THEN** its `IfcOpeningElement` is still a rectangle profile, the window's width by the wall's thickness plus 10 mm each side, extruded up its height

#### Scenario: Flat wall body
- **WHEN** a wall has a `height` and no `profile`
- **THEN** its `Body` is a rectangle profile of its length by its thickness, extruded up its height

#### Scenario: Gable wall body
- **WHEN** a wall has a `profile` top edge rising from eaves to a ridge and back
- **THEN** its `Body` is the closed side profile under that edge, extruded across the wall's thickness, so its top follows the roof line
