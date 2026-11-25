# building-schema Specification

## Purpose
The building JSON contract: a small zod schema (`src/schema/schema.ts`) that every model must pass
before anything downstream runs, exported as JSON Schema for other tools.

## Requirements

### Requirement: Fixed set of element types
The schema SHALL describe a building as one project, one site, one building, optional door and
window components, and at least one storey. Each storey SHALL hold only walls, openings (doors and
windows), slabs, rooms, optional stairs and optional railings. The schema SHALL carry
`schemaVersion: 1`.

#### Scenario: Model with no storeys
- **WHEN** a model has an empty `storeys` array
- **THEN** schema validation fails

#### Scenario: Unsupported element
- **WHEN** a storey contains a field such as `roofs` that the schema does not define
- **THEN** schema validation fails

#### Scenario: Storey with a stair
- **WHEN** a storey has a valid `stairs` array
- **THEN** schema validation passes

#### Scenario: Storey without stairs
- **WHEN** a storey omits `stairs`
- **THEN** schema validation passes

#### Scenario: Storey with railings
- **WHEN** a storey has a valid `railings` array
- **THEN** schema validation passes

#### Scenario: Storey without railings
- **WHEN** a storey omits `railings`
- **THEN** schema validation passes

### Requirement: Strict objects
Every schema object SHALL reject unknown fields, so a misspelt field is an error rather than being
ignored.

#### Scenario: Misspelt field
- **WHEN** a wall has `thicknes` instead of `thickness`
- **THEN** schema validation fails on that wall

### Requirement: Integer millimetre lengths
Every authored length SHALL be an integer number of millimetres. Thickness, height and width of
walls, openings, slabs, stair flights and landings, frames and glazing bars SHALL be positive;
`offsetAlongWall` and `sillHeight` SHALL be non-negative. Angles SHALL be finite numbers of degrees.
Derived lengths, such as a stair's riser height and going, MAY be fractional.

#### Scenario: Fractional length
- **WHEN** a wall's thickness is `200.5`
- **THEN** schema validation fails

#### Scenario: Zero thickness
- **WHEN** a wall's thickness is `0`
- **THEN** schema validation fails

#### Scenario: Fractional derived stair length
- **WHEN** a 3050 mm rise is divided into 16 risers
- **THEN** the derived riser height is 190.625 mm and schema validation of the authored stair passes

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
A door MAY have `doorway: true`, meaning an opening with no leaf, component or swing.
A window MAY have a `reveal` of `{ face: left|right, angle }`.

#### Scenario: Unknown opening kind
- **WHEN** an opening has `kind: "skylight"`
- **THEN** schema validation fails

#### Scenario: Window with a reveal
- **WHEN** a window has `reveal: { face: "left", angle: 45 }`
- **THEN** schema validation passes

#### Scenario: Doorway
- **WHEN** a door has `doorway: true`
- **THEN** schema validation passes; the model checks reject a component or swing on it

#### Scenario: Door with a reveal
- **WHEN** a door has a `reveal`
- **THEN** schema validation fails, because doors do not have reveals

### Requirement: Slabs and rooms
A slab SHALL have an outline, a thickness and an `elevationOffset` for its top relative to the
storey, and MAY have a `material` (see Slab material). A room SHALL have a non-empty name and an
outline. Outlines SHALL be open polygons of at least three points.

#### Scenario: Two-point outline
- **WHEN** a room outline has two points
- **THEN** schema validation fails

### Requirement: External storey
A storey MAY represent external ground: its elevation MAY be below the building's ground floor
(negative), it MAY have no rooms, and it MAY hold external works such as a ground slab and a stair
climbing to the lowest internal storey. The schema SHALL validate such a storey like any other.

#### Scenario: Below-grade storey with a stair to the ground floor
- **WHEN** a storey at -450 mm has a stair whose `toStoreyId` is the ground storey at 0 mm
- **THEN** schema validation passes

#### Scenario: External storey without rooms
- **WHEN** a storey has empty `walls`, `openings` and `rooms` arrays and a ground slab
- **THEN** schema validation passes

### Requirement: Slab material
A slab MAY have a `material` of `concrete` or `ground`, defaulting to `concrete` when omitted. The
material SHALL only select the slab's presentation colour and SHALL NOT change its geometry.

#### Scenario: Ground material accepted
- **WHEN** a slab has `material: "ground"`
- **THEN** schema validation passes

#### Scenario: Material omitted
- **WHEN** a slab omits `material`
- **THEN** schema validation passes and consumers treat the slab as `concrete`

#### Scenario: Unknown material rejected
- **WHEN** a slab has `material: "timber"`
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

### Requirement: Stair shape
A stair SHALL have an id, an optional name, a `toStoreyId` and one or more segments in bottom-to-top
order. A segment SHALL be a flight or a landing, discriminated by `kind`. A flight SHALL have
`start`, `end`, `width` and an integer `risers` of at least 2. A landing SHALL have an `outline` and
a positive `thickness`.

#### Scenario: Unknown segment kind
- **WHEN** a stair segment has `kind: "winder"`
- **THEN** schema validation fails

#### Scenario: Flight with one riser
- **WHEN** a stair flight has `risers: 1`
- **THEN** schema validation fails

#### Scenario: Landing with two points
- **WHEN** a stair landing outline has two points
- **THEN** schema validation fails

#### Scenario: Valid half-turn stair
- **WHEN** a stair has flight, landing and flight segments in that order
- **THEN** schema validation passes

### Requirement: Stair elevations are derived
A stair SHALL NOT store elevations, riser height or going. Its bottom SHALL be its containing
storey's elevation and its top SHALL be the elevation of the storey named by `toStoreyId`.
Intermediate levels SHALL follow from the ordered segments and the flights' riser counts. Going
SHALL be a flight's plan run divided by its risers minus one.

#### Scenario: Half landing height
- **WHEN** a stair rises 3050 mm over two flights of 8 risers each
- **THEN** the riser height is 190.625 mm and the landing is 1525 mm above the lower storey

#### Scenario: Going from the plan run
- **WHEN** a flight has 8 risers and a 1865 mm plan run
- **THEN** its going is 1865/7 mm, about 266.43 mm

#### Scenario: Uneven riser split still reaches the target
- **WHEN** a stair from a storey at 0 to a storey at 3050 mm has flights of 9 and 7 risers with a landing between them
- **THEN** the riser height is 190.625 mm, the landing is 1715.625 mm up, and walking the segments ends at 3050 mm

#### Scenario: Rounding the riser would miss the target
- **WHEN** the derived riser height is rounded to a whole millimetre before the levels are walked
- **THEN** the stair top is 3056 mm, not the target storey's 3050 mm, which is why derived lengths stay fractional

### Requirement: Railing shape
A railing SHALL have an id, an optional name, `start` and `end` points, a positive `height`, and
optional non-negative `startBase` and `endBase` offsets from the storey floor. It SHALL be a
straight run from `start` to `end`, and `height` SHALL be the height of the top of the rail above
the walking surface. A railing SHALL NOT store any other elevation.

#### Scenario: Negative base
- **WHEN** a railing's `startBase` is `-100`
- **THEN** schema validation fails

#### Scenario: Zero height
- **WHEN** a railing's `height` is `0`
- **THEN** schema validation fails

### Requirement: Railing base offsets
`startBase` and `endBase` SHALL be the walking surface at each end. An omitted base SHALL be 0.
Equal effective bases SHALL mean a level guard; different effective bases SHALL mean a sloped
handrail.

#### Scenario: Level railing
- **WHEN** a railing omits both bases
- **THEN** schema validation passes and both effective bases are 0

#### Scenario: Sloped railing
- **WHEN** a railing's `endBase` is 600 mm and its `startBase` is omitted
- **THEN** schema validation passes, the stored `endBase` is 600 and the omitted start base is effective 0

#### Scenario: Raised level railing
- **WHEN** a railing gives `startBase: 1525` and `endBase: 1525`
- **THEN** schema validation passes and the effective bases are equal
