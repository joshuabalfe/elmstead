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
`Elevation` SHALL be the storey elevation. Walls, slabs, doors and windows SHALL be contained in
their storey, and spaces SHALL be aggregated under it. Units SHALL be mm for length, m² for area,
m³ for volume and radians for plane angle.

#### Scenario: Storey contents
- **WHEN** a storey has walls, openings, slabs and rooms
- **THEN** its walls, slabs, doors and windows are contained in its `IfcBuildingStorey`, and its rooms are `IfcSpace`s aggregated under it

### Requirement: Element names and tags
Every element's `Tag` SHALL be its model id, and its `Name` SHALL be the model name, falling back to
the id.

#### Scenario: Unnamed wall
- **WHEN** a wall has no `name`
- **THEN** its `IfcWall` `Name` is the wall id

### Requirement: Walls and openings
A wall SHALL be an `IfcWall` (`NOTDEFINED`) with an `Axis` polyline and an extruded `Body`, placed
by its start, direction and justification. Each opening SHALL be an `IfcOpeningElement` that voids
its wall, and its box SHALL extend 10 mm past each wall face.

#### Scenario: Opening cut
- **WHEN** a wall has a window
- **THEN** an `IfcOpeningElement` voids the wall and the window fills that opening

### Requirement: Doors
A door SHALL fill its opening with a 50 mm `IfcDoor` panel. Its `OperationType` SHALL be
`SINGLE_SWING_LEFT` or `SINGLE_SWING_RIGHT`, following the IFC4 convention of looking from the side
it opens towards. A door without `swing` SHALL use `{ hinge: start, side: left }`.

#### Scenario: Door handing
- **WHEN** a door is viewed from the side it opens towards and its hinge is on the viewer's left
- **THEN** it is written as `SINGLE_SWING_LEFT`

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
component SHALL be an `IfcWindowType` (`WINDOW`, `SINGLE_PANEL`). Each type's `Name` SHALL be the
component name and its `Tag` the component id. Types SHALL be declared in the project
(`IfcRelDeclares`) and linked to their openings (`IfcRelDefinesByType`).

#### Scenario: Shared design
- **WHEN** two windows of different sizes name the same window component
- **THEN** both are instances of one `IfcWindowType`

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
Walls, slabs, doors, glazing, frames and bars SHALL carry `IfcStyledItem` surface colours. The
colours only help tell elements apart and have no building meaning.

#### Scenario: Viewer colours
- **WHEN** the IFC is opened in any viewer
- **THEN** walls, slabs, doors and glazing appear in distinct colours
