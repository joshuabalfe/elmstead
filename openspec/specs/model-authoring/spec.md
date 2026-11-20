# model-authoring Specification

## Purpose
How a building model is written: a TypeScript module in `models/`, using unit and geometry helpers
from `src/model/index.ts`, so dimensions can be named once and derived from each other.

## Requirements

### Requirement: Models are TypeScript modules
A model SHALL be either a `.ts` file whose default export is a `BuildingModel`, or a folder whose
`index.ts` default-exports one. The model's name SHALL be the file name without its extension, or
the folder name for a folder model. The name is used for every output file.

#### Scenario: Folder model
- **WHEN** a command is given `models/elmstead` or `models/elmstead/index.ts`
- **THEN** it loads `models/elmstead/index.ts` and names the outputs `elmstead`

#### Scenario: Single-file model
- **WHEN** a command is given `models/<name>.ts`
- **THEN** outputs are named `<name>`

### Requirement: Loading validates through JSON
Loading SHALL import the model, round-trip its default export through JSON, and parse the result
with the schema. A model that throws, has no default export, or fails the schema SHALL produce
ERROR issues and no model.

#### Scenario: No default export
- **WHEN** a model file has no default export
- **THEN** loading fails with "model has no default export"

#### Scenario: Model throws
- **WHEN** evaluating the model throws
- **THEN** loading fails with an ERROR that includes the stack trace

### Requirement: Schema errors name the element
Each schema error SHALL be reported against the nearest enclosing element id on its path, with the
JSON path and the schema message.

#### Scenario: Bad wall thickness
- **WHEN** wall `wall-south` has a non-positive thickness
- **THEN** the issue reads `ERROR   wall-south: schema: storeys.0.walls.0.thickness: …`

### Requirement: Branded millimetre units
`mm(n)` and `m(n)` SHALL return a branded `Mm` integer and SHALL throw if the value is not a whole
number of millimetres. A bare number SHALL NOT type-check as `Mm`. Arithmetic helpers SHALL keep
values as `Mm`:
- `add`, `sub` and `neg`;
- `scale`, which rounds to the nearest mm;
- `div`, which throws unless exact;
- `divRound`.

`deg(n)` SHALL accept any finite number.

#### Scenario: Fractional metres
- **WHEN** a model calls `m(1.2345)`
- **THEN** it throws a RangeError

#### Scenario: Inexact division
- **WHEN** a model calls `div(mm(1000), 3)`
- **THEN** it throws a RangeError

### Requirement: Wall and room helpers
The helpers SHALL only build plain schema values. `defineBuilding` SHALL fill in `schemaVersion`.
`wall` SHALL be centre-justified by default. `rectWalls` SHALL make four left-justified external
walls, counter-clockwise, whose outer faces form the given rectangle. `face` SHALL give the
coordinate of a named face of an axis-aligned wall, `faceCrossing` where a face of a wall at any
angle crosses a given x or y, and `rectRoom` a rectangular room.

#### Scenario: Rectangle of external walls
- **WHEN** `rectWalls("wall", pt(0,0), m(8), m(6), { thickness: mm(200), … })` is called
- **THEN** the walls' outer faces lie on x=0, x=8000, y=0 and y=6000, and their corners neither overlap nor leave gaps

### Requirement: Opening and component helpers
`door` and `window` SHALL make openings on a wall, linked to a component if given one. `door` SHALL
set `sillHeight: 0`. `doorComponent` and `windowComponent` SHALL make designs. `centredOn` SHALL
give the offset that centres an opening on a plan coordinate.

#### Scenario: Door with a component
- **WHEN** `door("door-living", wall, offset, internalDoor, size)` is called
- **THEN** the door's `componentId` is `internalDoor.id` and its `sillHeight` is 0

#### Scenario: Centred window
- **WHEN** `centredOn(wall, at, width)` is used as a window's offset
- **THEN** the window's centre lies at plan coordinate `at` along that wall

### Requirement: Plan coordinates
Each storey's plan SHALL use x east and y north, in mm. Heights SHALL be measured up from the
storey's `elevation`. `site.northAngle` SHALL be true north's angle counter-clockwise from plan +y,
defaulting to 0.

#### Scenario: North angle omitted
- **WHEN** `site.northAngle` is left out
- **THEN** true north is taken as plan +y
