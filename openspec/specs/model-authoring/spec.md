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
set `sillHeight: 0`. `window` SHALL take an optional reveal last, as `door` takes a swing.
`doorComponent` and `windowComponent` SHALL make designs. `centredOn` SHALL give the offset that
centres an opening on a plan coordinate.

#### Scenario: Door with a component
- **WHEN** `door("door-living", wall, offset, internalDoor, size)` is called
- **THEN** the door's `componentId` is `internalDoor.id` and its `sillHeight` is 0

#### Scenario: Centred window
- **WHEN** `centredOn(wall, at, width)` is used as a window's offset
- **THEN** the window's centre lies at plan coordinate `at` along that wall

#### Scenario: Window with a reveal
- **WHEN** `window("window-living", wall, offset, frontWindow, size, { face: "left", angle: deg(45) })` is called
- **THEN** the window's `reveal` is `{ face: "left", angle: 45 }`

#### Scenario: Window without a reveal
- **WHEN** `window` is called without a reveal
- **THEN** the window has no `reveal` field

### Requirement: Plan coordinates
Each storey's plan SHALL use x east and y north, in mm. Heights SHALL be measured up from the
storey's `elevation`. `site.northAngle` SHALL be true north's angle counter-clockwise from plan +y,
defaulting to 0.

#### Scenario: North angle omitted
- **WHEN** `site.northAngle` is left out
- **THEN** true north is taken as plan +y

### Requirement: Stair helpers
`stairFlight(id, start, end, { width, risers })`, `stairLanding(id, outline, { thickness })` and
`stair(id, toStorey, segments)` SHALL build plain stair values. `stair` SHALL take the destination
`Storey` and record its id as `toStoreyId`. The helpers SHALL NOT compute elevations; the model
supplies plan geometry and riser counts only.

#### Scenario: Assembling a half-turn stair
- **WHEN** a model passes a lower flight, a half landing and an upper flight to `stair("stair-main", firstFloor, …)`
- **THEN** the stair's `toStoreyId` is `firstFloor.id` and its segments are in the given order

#### Scenario: Flight values
- **WHEN** `stairFlight("stair-flight-lower", start, end, { width: mm(825), risers: 8 })` is called
- **THEN** it returns a flight with those points, width and riser count

#### Scenario: Landing values
- **WHEN** `stairLanding("stair-landing-half", outline, { thickness: mm(150) })` is called
- **THEN** it returns a landing with that outline and thickness

### Requirement: Derived stair dimensions are plain numbers
Derived stair dimensions — the riser height, each flight's going and every segment's level — SHALL be
plain `number` millimetres, not the branded `Mm`. `Mm` is an integer brand, so `mm()` and `div()`
throw on a fraction and `divRound()` would round a 3050 / 16 riser to 191 mm, making sixteen risers
reach 3056 mm and miss the target storey. The IFC writer's `len` and `posLen` already take a plain
number, so nothing converts on the way out.

#### Scenario: Fractional riser height
- **WHEN** a stair geometry helper divides a 3050 mm rise into 16 risers
- **THEN** it returns 190.625 as a `number`, without passing it through `mm()`

#### Scenario: Division that must not round
- **WHEN** the helper divides a rise by a riser count
- **THEN** it uses plain division, because `div(mm(3050), 16)` throws and `divRound(mm(3050), 16)` gives 191
