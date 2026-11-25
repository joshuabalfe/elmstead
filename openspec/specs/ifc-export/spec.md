# ifc-export Specification

## Purpose
Writing the validated model to IFC4 (STEP) with web-ifc (`src/ifc/writer.ts`), deterministically,
so other IFC tools see the same building the model describes. IFC is only ever produced by this
writer.

## Requirements

### Requirement: Written from the JSON contract
The IFC SHALL be written from `out/<name>.building.json`, re-parsed with the schema, and not from
the in-memory TypeScript model.

#### Scenario: Build order
- **WHEN** `build` runs
- **THEN** the JSON file is written first and the IFC writer reads its parsed contents

### Requirement: Spatial structure and units
The file SHALL nest `IfcProject` → `IfcSite` → `IfcBuilding` → `IfcBuildingStorey`. Each storey's
`Elevation` SHALL be the storey elevation. Walls, slabs, doors, windows and railings SHALL be
contained in their storey, and spaces SHALL be aggregated under it. Units SHALL be mm for length, m²
for area, m³ for volume and radians for plane angle.

#### Scenario: Storey contents
- **WHEN** a storey has walls, openings, slabs and rooms
- **THEN** its walls, slabs, doors and windows are contained in its `IfcBuildingStorey`, and its rooms are `IfcSpace`s aggregated under it

#### Scenario: Storey with a railing
- **WHEN** a storey has a railing
- **THEN** its `IfcRailing` is contained in its `IfcBuildingStorey`

### Requirement: Element names and tags
Every element's `Tag` SHALL be its model id, and its `Name` SHALL be the model name, falling back to
the id.

#### Scenario: Unnamed wall
- **WHEN** a wall has no `name`
- **THEN** its `IfcWall` `Name` is the wall id

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

### Requirement: Doors
A door that is not a doorway SHALL fill its opening with a 50 mm `IfcDoor` panel. Its `OperationType` SHALL be
`SINGLE_SWING_LEFT` or `SINGLE_SWING_RIGHT`, following the IFC4 convention of looking from the side
it opens towards. A door that is not a doorway and has no `swing` SHALL use
`{ hinge: start, side: left }`.

#### Scenario: Door handing
- **WHEN** a door is viewed from the side it opens towards and its hinge is on the viewer's left
- **THEN** it is written as `SINGLE_SWING_LEFT`

### Requirement: Doorways
A doorway (`doorway: true`) SHALL NOT have a filling: only the `IfcOpeningElement` and
`IfcRelVoidsElement` are written, with no `IfcDoor` or `IfcRelFillsElement`. The opening SHALL
carry the doorway's id as `Tag` and its name as `Name`.

#### Scenario: Doorway
- **WHEN** a door has `doorway: true`
- **THEN** its wall is voided and no IfcDoor or IfcRelFillsElement is written

### Requirement: Windows
A window SHALL fill its opening with an `IfcWindow`: one 50 mm glass panel per pane, plus a 70 mm
deep box for each frame piece and glazing bar. These pieces SHALL NOT overlap.

#### Scenario: Window with glazing bars
- **WHEN** a window's design has a frame and a 3 × 2 grid of panes
- **THEN** the `IfcWindow` has six glass panels plus frame and bar boxes, and their areas add up to the opening's

### Requirement: Slabs and spaces
A slab SHALL be an `IfcSlab` (`FLOOR`): its outline extruded down from `elevationOffset` by its
thickness. A room SHALL be an `IfcSpace` (`INTERNAL`) with only a 2D `FootPrint`, because rooms have
no height yet. Its `Name` SHALL be the room id and its `LongName` the room name.

#### Scenario: Room in IFC
- **WHEN** a model has room `room-living` named "Living room"
- **THEN** the IFC has an `IfcSpace` with `Name` `room-living`, `LongName` "Living room" and a footprint but no body

### Requirement: Components as types
Each door component SHALL be an `IfcDoorType` (`DOOR`, operation `NOTDEFINED`). Each window
component SHALL be an `IfcWindowType` (`WINDOW`) whose `PartitioningType` follows its glazing grid;
its instances SHALL carry the same value. Types SHALL carry the component name and id, be declared
in the project and be linked to their openings.

#### Scenario: Shared design
- **WHEN** two windows of different sizes name the same window component
- **THEN** both are instances of one `IfcWindowType`

#### Scenario: Glazed front window
- **WHEN** a window component has three columns and two rows of panes
- **THEN** its `IfcWindowType` and instances use `USERDEFINED` with `UserDefinedPartitioningType` "3x2 grid"

#### Scenario: Two-pane window
- **WHEN** a window component has two columns and one row of panes
- **THEN** its `IfcWindowType` and instances use `DOUBLE_PANEL_VERTICAL`

#### Scenario: Two rows of panes
- **WHEN** a window component has one column and two rows of panes
- **THEN** its `IfcWindowType` and instances use `DOUBLE_PANEL_HORIZONTAL`

#### Scenario: Three panes in a row
- **WHEN** a window component has three columns and one row of panes
- **THEN** its `IfcWindowType` and instances use `TRIPLE_PANEL_VERTICAL`

#### Scenario: Three panes in a column
- **WHEN** a window component has one column and three rows of panes
- **THEN** its `IfcWindowType` and instances use `TRIPLE_PANEL_HORIZONTAL`

#### Scenario: Plain window
- **WHEN** a window component has no glazing
- **THEN** its `IfcWindowType` and instances use `SINGLE_PANEL`

### Requirement: Deterministic GlobalIds
Every GlobalId SHALL be a UUIDv5 compressed to IFC's 22-character form. The UUID SHALL be made from
the namespace `ccd47317-e750-4598-9af4-4e20a6f6deca` and a key:
- for an element or component, its id;
- for an entity with no id of its own, a derived key such as `<id>#opening`, `<id>#voids`, `<id>#fills`, `<storey>#contains`, `<storey>#spaces`, `<parent>#aggregates`, `<component>#instances` or `<project>#types`.

#### Scenario: Element moved
- **WHEN** a wall is moved or resized but keeps its id
- **THEN** its GlobalId is unchanged

#### Scenario: Element renamed
- **WHEN** a wall's id changes
- **THEN** its GlobalId changes

### Requirement: Byte-identical output
The same model SHALL always give a byte-identical IFC file. The header timestamp SHALL be
`1970-01-01T00:00:00` and the authorization `'none'`.

#### Scenario: Two builds
- **WHEN** the same model is built twice
- **THEN** the two IFC files are byte-identical

### Requirement: Display colours
Walls, slabs, doors, glazing, frames and bars, stair flights and stair landings, ground slabs and
railings SHALL carry `IfcStyledItem` surface colours. The colours only help tell elements apart and
have no building meaning. The stair, ground and railing colours SHALL each be at least 0.02 away in
RGB distance from every other entry in `STYLES`, so the viewer's `styleOf` recognises them as
themselves rather than as a wall or a slab and patching their upward faces.

#### Scenario: Viewer colours
- **WHEN** the IFC is opened in any viewer
- **THEN** walls, slabs, doors and glazing appear in distinct colours

#### Scenario: Stair colours
- **WHEN** the IFC is opened in any viewer
- **THEN** stair flights and landings appear in a colour distinct from walls, slabs, doors and glazing

#### Scenario: Stair material is not recognised as a wall or slab
- **WHEN** the viewer's plan style looks for the wall and slab colours among a stair's material
- **THEN** it finds neither, so the classifier leaves the stair material alone instead of painting its tops charcoal or discarding them (the readability recolour is a separate shader, see `ifc-viewer`)

#### Scenario: Railing colour
- **WHEN** the IFC is opened in any viewer
- **THEN** railings appear in a colour distinct from walls, slabs, doors, glazing, stairs and ground

#### Scenario: Railing material is not recognised as a wall or slab
- **WHEN** the viewer's plan style looks for the wall and slab colours among a railing's material
- **THEN** it finds neither, so the classifier leaves the railing material alone

### Requirement: Ground display colour
A slab whose material is `ground` SHALL carry the `ground` entry's surface colour; a concrete slab
SHALL keep the existing slab colour.

#### Scenario: Ground slab colour
- **WHEN** a model has a slab with `material: "ground"`
- **THEN** the IFC gives it the ground display colour, distinct from concrete slabs

#### Scenario: Concrete slab unchanged
- **WHEN** a slab omits `material`
- **THEN** its display colour is the existing slab colour, byte-identical to before this change

### Requirement: Stair container and flights
A stair SHALL be an `IfcStair` contained in its storey, with a `PredefinedType` derived from the
turning angle between consecutive flights' plan directions. Each flight SHALL be an `IfcStairFlight`
with `NumberOfRisers`, `NumberOfTreads` (risers minus one), `RiserHeight`, `TreadLength` and a stepped
body. These are the IFC4 names: IFC2x3 called them `ShapeType` and `NumberOfRiser`, and IFC4 rejects
both spellings.

#### Scenario: Half-turn stair
- **WHEN** a stair has two flights separated by a 180° landing
- **THEN** its `IfcStair` has `PredefinedType` `HALF_TURN_STAIR` and one `IfcStairFlight` per flight

#### Scenario: Straight stair
- **WHEN** a stair has one straight flight and no landing
- **THEN** its `IfcStair` has `PredefinedType` `STRAIGHT_RUN_STAIR`

#### Scenario: Two flights that do not turn
- **WHEN** a stair's two flights run in the same direction, with a landing between them
- **THEN** its `IfcStair` has `PredefinedType` `TWO_STRAIGHT_RUN_STAIR`

#### Scenario: Quarter turn
- **WHEN** a stair's two flights turn through 90°
- **THEN** its `IfcStair` has `PredefinedType` `QUARTER_TURN_STAIR`

#### Scenario: Turning angle matches no arrangement
- **WHEN** a stair's two flights turn through 45°
- **THEN** its `IfcStair` has `PredefinedType` `NOTDEFINED`

#### Scenario: Flight attributes
- **WHEN** a flight has 8 risers and a 1865 mm run
- **THEN** its `IfcStairFlight` has `NumberOfRisers` 8, `NumberOfTreads` 7, and derived `RiserHeight` and `TreadLength`

### Requirement: Stair landings
Each landing SHALL be an `IfcSlab` with `PredefinedType` `LANDING` and a body extruded downwards
from the landing level by its thickness.

#### Scenario: Half landing
- **WHEN** a stair has a landing between two flights
- **THEN** the IFC has an `IfcSlab` with `PredefinedType` `LANDING` at the cumulative height of the lower flight

### Requirement: Stair decomposition
Flights and landings SHALL be aggregated under their `IfcStair` with `IfcRelAggregates`. The
`IfcStair` itself SHALL have no body, so the stair geometry is counted once through its parts.

#### Scenario: One aggregate
- **WHEN** a stair has two flights and one landing
- **THEN** one `IfcRelAggregates` links the `IfcStair` to both flights and the landing, and the `IfcStair` has no `Representation`

### Requirement: Railings
A railing SHALL be an `IfcRailing` contained in its storey. Its `PredefinedType` SHALL be
`HANDRAIL` when its effective base offsets differ (an omitted base is 0) and `GUARDRAIL` when they
are equal. Its body SHALL be a top rail whose top surface is `height` above the walking surface,
swept along the run, plus posts from that surface to the rail, all styled with the railing colour.

#### Scenario: Sloped handrail
- **WHEN** a railing's end base is above its start base
- **THEN** its `IfcRailing` has `PredefinedType` `HANDRAIL` and its rail rises from start to end

#### Scenario: Level guardrail
- **WHEN** a railing omits both bases
- **THEN** its `IfcRailing` has `PredefinedType` `GUARDRAIL` and its rail is level

#### Scenario: Rail and posts
- **WHEN** a railing is 2000 mm long with a 900 mm height
- **THEN** its body contains one top rail and posts at both ends and at intervals no greater than 160 mm, in the railing display colour

#### Scenario: Oriented rail
- **WHEN** a railing's bases differ
- **THEN** its rail solid's axis runs along the 3D rail line and its extrusion depth is the 3D length
