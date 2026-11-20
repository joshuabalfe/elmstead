# building-schema Specification

## Purpose
The building JSON contract: a small zod schema (`src/schema/schema.ts`) that every model must pass
before anything downstream runs, exported as JSON Schema for other tools.

## Requirements

### Requirement: Fixed set of element types
The schema SHALL describe a building as one project, one site, one building, optional door and
window components, and at least one storey. Each storey SHALL hold only walls, openings (doors and
windows), slabs and rooms. The schema SHALL carry `schemaVersion: 1`.

#### Scenario: Model with no storeys
- **WHEN** a model has an empty `storeys` array
- **THEN** schema validation fails

#### Scenario: Unsupported element
- **WHEN** a storey contains a field such as `stairs` that the schema does not define
- **THEN** schema validation fails

### Requirement: Strict objects
Every schema object SHALL reject unknown fields, so a misspelt field is an error rather than being
ignored.

#### Scenario: Misspelt field
- **WHEN** a wall has `thicknes` instead of `thickness`
- **THEN** schema validation fails on that wall

### Requirement: Integer millimetre lengths
Every length SHALL be an integer number of millimetres. Thickness, height and width of walls,
openings, slabs, frames and glazing bars SHALL be positive; `offsetAlongWall` and `sillHeight`
SHALL be non-negative. Angles SHALL be finite numbers of degrees.

#### Scenario: Fractional length
- **WHEN** a wall's thickness is `200.5`
- **THEN** schema validation fails

#### Scenario: Zero thickness
- **WHEN** a wall's thickness is `0`
- **THEN** schema validation fails

### Requirement: Kebab-case ids
Every project, site, building, storey, element and component SHALL have an id matching
`^[a-z0-9]+(-[a-z0-9]+)*$`.

#### Scenario: Upper-case id
- **WHEN** a wall's id is `Wall-North`
- **THEN** schema validation fails with a message saying ids are lower-case kebab-case

### Requirement: Walls
A wall SHALL be straight, from `start` to `end`, with a `justification` of `centre`, `left` or
`right` relative to that line, looking from start to end.

#### Scenario: Unknown justification
- **WHEN** a wall has `justification: "middle"`
- **THEN** schema validation fails

### Requirement: Openings
An opening SHALL be a `door` or a `window`, discriminated by `kind`. It SHALL name its host wall by
`wallId` and MAY name its design by `componentId`. It SHALL have an `offsetAlongWall`, `width`,
`height` and `sillHeight`. A door MAY have a `swing` of `{ hinge: start|end, side: left|right }`.
A window MAY have a `reveal` of `{ face: left|right, angle }`.

#### Scenario: Unknown opening kind
- **WHEN** an opening has `kind: "skylight"`
- **THEN** schema validation fails

#### Scenario: Window with a reveal
- **WHEN** a window has `reveal: { face: "left", angle: 45 }`
- **THEN** schema validation passes

#### Scenario: Door with a reveal
- **WHEN** a door has a `reveal`
- **THEN** schema validation fails, because doors do not have reveals

### Requirement: Slabs and rooms
A slab SHALL have an outline, a thickness and an `elevationOffset` for its top relative to the
storey. A room SHALL have a non-empty name and an outline. Outlines SHALL be open polygons of at
least three points.

#### Scenario: Two-point outline
- **WHEN** a room outline has two points
- **THEN** schema validation fails

### Requirement: Components describe designs, not sizes
Door components SHALL have only an id and name. A window component SHALL have an id, a name, an
optional `frame` (`width`) and optional `glazing`. Glazing is `columns` and `rows` as positive
ratios (at least one each) plus a `barWidth`. Sizes SHALL belong to the openings, not the
components.

#### Scenario: Glazing with no columns
- **WHEN** a window component's glazing has `columns: []`
- **THEN** schema validation fails

### Requirement: Exported JSON Schema
`schema/building.schema.json` SHALL be the zod schema exported as JSON Schema (draft 2020-12) by
`npm run schema`. The test suite SHALL fail if the committed file differs from a fresh export.

#### Scenario: Schema changed without regenerating
- **WHEN** `src/schema/schema.ts` changes and `npm run schema` is not run
- **THEN** `npm test` fails on the stale JSON Schema

### Requirement: Splayed reveals
A window's `reveal` SHALL splay both jambs at `angle` degrees off square, from the middle of the
wall's thickness to the named `face`, looking from the wall's start to its end. The head, the sill
and the reveal from the middle to the other face SHALL stay square. The window's `width` SHALL be its
width in the middle of the wall. `angle` SHALL be more than 0 and less than 90.

#### Scenario: Width at the splayed face
- **WHEN** a 1200 mm window in a 400 mm wall has a 45° reveal
- **THEN** the opening is 1200 mm wide from the other face to the middle of the wall and 1600 mm wide at the splayed face

#### Scenario: Square reveal angle
- **WHEN** a window's reveal angle is `0`
- **THEN** schema validation fails

#### Scenario: Right-angle reveal
- **WHEN** a window's reveal angle is `90`
- **THEN** schema validation fails
