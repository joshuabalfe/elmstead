# Spec Delta

## Purpose
Known real-world dimensions of a building, recorded beside its model as constraints between named
points, and checked on every command so an edit to the model cannot silently break a measurement.

## ADDED Requirements

### Requirement: Constraints file beside the model
A folder model's constraints SHALL be read from `constraints.ts` in its folder, and a single-file
model's from `<name>.constraints.ts` beside it. The file SHALL default-export a list of constraint
groups. A model with no constraints file SHALL have no constraints and SHALL NOT be reported.

#### Scenario: Folder model
- **WHEN** a command is given `models/elmstead`
- **THEN** it reads constraints from `models/elmstead/constraints.ts`

#### Scenario: Single-file model
- **WHEN** a command is given `models/example-cottage.ts`
- **THEN** it reads constraints from `models/example-cottage.constraints.ts`

#### Scenario: No constraints file
- **WHEN** a model has no constraints file
- **THEN** the command runs as before and prints no constraint issues

### Requirement: Constraints stay out of the building outputs
Constraints SHALL NOT appear in `building.json`, the exported JSON Schema or the IFC, and adding,
changing or removing constraints SHALL NOT change any of those files.

#### Scenario: Constraint added
- **WHEN** a constraint is added to a model's constraints file and the model is built
- **THEN** the JSON and IFC are byte-identical to the build without it

### Requirement: Constraints files are validated
The constraints file SHALL be loaded like a model: evaluated, round-tripped through JSON and
validated strictly. Constraint ids SHALL be kebab-case and unique within the file. Any failure SHALL
be an ERROR against the constraint id, or the file path. The command SHALL then print
`FAILED  <constraints path>: constraints did not validate`, write nothing and exit with status 1.

#### Scenario: Misspelt field
- **WHEN** a constraint has `tolerence` instead of `tolerance`
- **THEN** loading reports an ERROR against that constraint and the command writes nothing

#### Scenario: Failure names the constraints file
- **WHEN** `models/elmstead/constraints.ts` throws while being evaluated
- **THEN** the command prints `FAILED  models/elmstead/constraints.ts: constraints did not validate`, not a model failure, and exits 1

#### Scenario: Duplicate constraint id
- **WHEN** two constraints share an id
- **THEN** loading reports an ERROR against that id

### Requirement: Groups by storey or room
Each group SHALL name exactly one storey or one room as its scope. A scope id the model does not
have SHALL be an ERROR against the group. Each constraint issue SHALL be against the constraint id
and SHALL end with the scope in brackets.

#### Scenario: Room group
- **WHEN** a constraint in a group scoped to `room-living` fails
- **THEN** its ERROR reads `ERROR   <constraint-id>: … (room-living)`

#### Scenario: Unknown scope
- **WHEN** a group is scoped to a room that has been renamed
- **THEN** an ERROR says the group's room is not in the model

### Requirement: Points are named from the model
A constraint SHALL have two points, `from` and `to`, each resolved from the model by id. A point
SHALL NOT be a raw coordinate. A point that names an id the model does not have, or an element of
the wrong kind, SHALL be an ERROR against the constraint.

#### Scenario: Element renamed
- **WHEN** a constraint's point names `window-living` and that window's id changes
- **THEN** the constraint reports an ERROR that `window-living` is not in the model

#### Scenario: Wrong kind
- **WHEN** an opening point names a wall id
- **THEN** the constraint reports an ERROR that the id is a wall, not an opening

### Requirement: Wall faces
A point that uses a wall face SHALL name it `left` or `right`, looking from the wall's start to its
end, or by compass (`north`, `south`, `east`, `west`) when the wall runs along plan x or y and has a
face on that side. Any other compass face SHALL be an ERROR against the constraint.

#### Scenario: Compass face on an axis-aligned wall
- **WHEN** a point names the `east` face of a wall running north–south
- **THEN** it resolves to that wall's east face

#### Scenario: Compass face on a diagonal wall
- **WHEN** a point names the `north` face of a diagonal wall
- **THEN** the constraint reports an ERROR saying to use `left` or `right`

### Requirement: Corner points
A corner point SHALL name two walls and one face of each, and SHALL resolve to where the lines of
those two faces cross. Faces that are parallel SHALL be an ERROR against the constraint.

#### Scenario: Inside corner of a room
- **WHEN** a corner names the east face of `wall-west` and the north face of `wall-south`
- **THEN** it resolves to the inside south-west corner between those walls

#### Scenario: Parallel faces
- **WHEN** a corner names faces of two parallel walls
- **THEN** the constraint reports an ERROR that the faces do not meet

### Requirement: Wall end points
A wall end point SHALL name a wall and `start` or `end`. Without a face it SHALL resolve to that end
of the wall's start–end line; with a face it SHALL resolve to that end of the named face.

#### Scenario: End of a face
- **WHEN** a point names the `start` of `wall-south` on its `north` face
- **THEN** it resolves to the north face at the wall's start

### Requirement: Opening points
An opening point SHALL name an opening and `start`, `end` or `centre`: the jamb nearest the wall's
start, the far jamb, or half way between. Without a face it SHALL lie on the host wall's start–end
line; with a face, on that face of the host wall.

#### Scenario: Window jamb on a face
- **WHEN** a point names the `start` of a window on the `left` face of its wall
- **THEN** it resolves to the wall's left face at `offsetAlongWall` from the wall's start

#### Scenario: Window width
- **WHEN** a constraint runs from a window's `start` to its `end`, measured along its wall
- **THEN** the measured distance is the window's width

### Requirement: Room corner points
A room corner point SHALL name a room and either a compass corner (`north-east`, `north-west`,
`south-east`, `south-west`) or a vertex number counted from 0. A compass corner SHALL be the outline
vertex furthest in that direction, and SHALL be an ERROR if two vertices tie. In a room group the
room MAY be left out, meaning the group's room.

#### Scenario: Rectangular room
- **WHEN** a point names the `south-west` corner of a rectangular room
- **THEN** it resolves to the room's south-west vertex

#### Scenario: Ambiguous corner
- **WHEN** an L-shaped room has two vertices equally far to the north-east
- **THEN** the constraint reports an ERROR saying to name a vertex number instead

#### Scenario: Room left out in a room group
- **WHEN** a constraint in a group scoped to `room-living` names a room corner without a room
- **THEN** the corner is taken from `room-living`

#### Scenario: Room left out in a storey group
- **WHEN** a constraint in a storey group names a room corner without a room
- **THEN** the constraint reports an ERROR that the room corner needs a room

### Requirement: Points on one storey
Both points of a constraint, and any wall it is measured along, SHALL be on one storey: the group's
storey, or for a room group the storey holding that room. Anything on another storey SHALL be an
ERROR against the constraint.

#### Scenario: Points on two storeys
- **WHEN** a constraint runs from a ground-floor wall to a first-floor window
- **THEN** the constraint reports an ERROR that its points are on different storeys

#### Scenario: Room group on another storey
- **WHEN** a constraint in a group scoped to a ground-floor room names a first-floor window
- **THEN** the constraint reports an ERROR that the window is not on the room's storey

### Requirement: How a distance is measured
Each constraint SHALL say how it is measured: `straight` (the straight-line distance), `x` or `y`
(the difference in that plan coordinate, unsigned), or along a named wall (the distance between the
two points projected onto that wall's direction, unsigned). A measure along an id the model does not
have, or one that is not a wall, SHALL be an ERROR against the constraint.

#### Scenario: Along an angled wall
- **WHEN** two points on different faces of a diagonal wall are measured along that wall
- **THEN** the distance counts only the component parallel to the wall, not the wall thickness

#### Scenario: Plan x
- **WHEN** a constraint between points at x = 450 and x = 4025 is measured in `x`
- **THEN** the measured distance is 3575 mm whatever their y

#### Scenario: Along a missing wall
- **WHEN** a constraint is measured along `wall-x` and the model has no `wall-x`
- **THEN** the constraint reports an ERROR that `wall-x` is not in the model

### Requirement: Met within a tolerance
A constraint SHALL give its distance in whole mm and MAY give a tolerance in whole mm, defaulting to
10 mm. The measured distance SHALL be rounded to the nearest mm, and the constraint SHALL be met when
that differs from its distance by no more than the tolerance.

#### Scenario: Within the default tolerance
- **WHEN** a constraint of 1775 mm with no tolerance measures 1783 mm
- **THEN** it is met

#### Scenario: Outside its tolerance
- **WHEN** a constraint of 1775 mm with a tolerance of 5 mm measures 1783 mm
- **THEN** it is not met

#### Scenario: Fractional measurement at the limit
- **WHEN** a constraint of 1775 mm with no tolerance measures 1785.4 mm in a straight line
- **THEN** it is met, because the measurement rounds to 1785 mm

### Requirement: Failures name the measurement
A constraint that is not met SHALL be an ERROR against the constraint id giving the rounded measured
distance and the required distance and tolerance, in the form
`is <measured> mm, should be <distance> ±<tolerance> mm (<scope>)`.

#### Scenario: Window moved
- **WHEN** a window is moved 25 mm further along its wall, breaking a 1775 mm constraint
- **THEN** the command prints `ERROR   <constraint-id>: is 1800 mm, should be 1775 ±10 mm (<scope>)`

### Requirement: Constraints gate the commands
`check`, `build`, `render` and `all` SHALL check constraints once, alongside the model checks and
before writing anything; `all` checks them in its build step only. A constraint ERROR SHALL stop
the command as a model check ERROR does: nothing in `out/` changes and the exit status is 1.

#### Scenario: Build with a broken constraint
- **WHEN** `build` runs on a model that breaks one of its constraints
- **THEN** it prints the constraint ERROR, writes no JSON or IFC and exits 1

#### Scenario: Check reports every failure
- **WHEN** a model breaks a model check and two constraints
- **THEN** `check` prints all three ERRORs and exits 1

#### Scenario: All checks once
- **WHEN** `all` runs on a model whose constraints are met
- **THEN** the constraints are checked once and the summary line is printed once

### Requirement: Constraint summary
When a model has a constraints file, `check`, `build`, `render` and `all` SHALL print exactly one
line giving the constraints file and how many constraints were met out of how many there are.

#### Scenario: All met
- **WHEN** a model has a constraints file with 12 constraints that are all met
- **THEN** the command prints `constr  models/elmstead/constraints.ts: 12 of 12 met`
