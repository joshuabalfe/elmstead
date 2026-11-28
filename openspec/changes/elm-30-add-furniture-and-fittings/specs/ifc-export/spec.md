# Spec Delta

## MODIFIED Requirements

### Requirement: Spatial structure and units

The file SHALL nest `IfcProject` → `IfcSite` → `IfcBuilding` → `IfcBuildingStorey`. Each storey's
`Elevation` SHALL be the storey elevation. Walls, slabs, doors, windows, railings and furnishings
SHALL be contained in their storey, and spaces SHALL be aggregated under it. Units SHALL be mm for
length, m² for area, m³ for volume and radians for plane angle.

#### Scenario: Storey contents

- **WHEN** a storey has walls, openings, slabs and rooms
- **THEN** its walls, slabs, doors and windows are contained in its `IfcBuildingStorey`, and its rooms are `IfcSpace`s aggregated under it

#### Scenario: Storey with a railing

- **WHEN** a storey has a railing
- **THEN** its `IfcRailing` is contained in its `IfcBuildingStorey`

#### Scenario: Storey with a furnishing

- **WHEN** a storey has a furnishing
- **THEN** its `IfcFurniture` or `IfcSanitaryTerminal` is contained in its `IfcBuildingStorey`

## ADDED Requirements

### Requirement: Furnishings

A furniture furnishing SHALL be an `IfcFurniture` and a sanitary furnishing an `IfcSanitaryTerminal`,
each contained in its storey with `Tag` = id and `Name` = name or id. Its body SHALL be one solid per
part, placed at `at` and turned by `rotation`, with its base at the storey elevation plus
`elevationOffset`.

#### Scenario: Furniture class

- **WHEN** a model has a `sofa` furnishing
- **THEN** the IFC has an `IfcFurniture` with that id as its tag, contained in the sofa's storey

#### Scenario: Sanitary class

- **WHEN** a model has a `bath` furnishing
- **THEN** the IFC has an `IfcSanitaryTerminal` with `PredefinedType` `BATH`, contained in its storey

#### Scenario: Body from parts

- **WHEN** a chair is exported
- **THEN** its body has one extruded solid for each of its derived parts, not one block

#### Scenario: Placement and rotation

- **WHEN** a table at (3000, 2000) with `rotation: 90` and `elevationOffset: 0` is exported on a storey at 3100 mm
- **THEN** its body stands on z = 3100 mm and its local x axis points along plan +y

#### Scenario: Raised furnishing

- **WHEN** a shelf has `elevationOffset: 900`
- **THEN** its lowest part starts 900 mm above the storey elevation

### Requirement: Furnishing footprint

Each furnishing SHALL also carry a `FootPrint` representation: a closed 2D curve of its overall
footprint, placed with the furnishing.

#### Scenario: Footprint outline

- **WHEN** a 1500 by 800 mm table is exported
- **THEN** it has a `FootPrint` representation whose outline is a 1500 by 800 mm rectangle in the table's placement

#### Scenario: Body unchanged

- **WHEN** a furnishing has a footprint representation
- **THEN** its `Body` representation is still the swept solids of its parts

### Requirement: Furnishing types

Each kind used in a model SHALL be written once as an `IfcFurnitureType` or `IfcSanitaryTerminalType`,
related to every furnishing of that kind with `IfcRelDefinesByType` and declared by the project. A
kind no furnishing uses SHALL NOT be written.

#### Scenario: One type per kind

- **WHEN** a model has three `chair` furnishings and one `bed`
- **THEN** the IFC has one `IfcFurnitureType` related to all three chairs and one related to the bed

#### Scenario: Unused kind

- **WHEN** a model has no `shelf` furnishing
- **THEN** the IFC has no `IfcFurnitureType` with `PredefinedType` `SHELF`

#### Scenario: Type ids are stable

- **WHEN** the same model is built twice
- **THEN** every furnishing type has the same GlobalId both times

### Requirement: Furnishing predefined types

A furnishing's `PredefinedType` SHALL be its kind's IFC value, on its element and on its type. `bed`, `chair`, `desk`,
`file-cabinet`, `shelf`, `sofa` and `table` SHALL map to `BED`, `CHAIR`, `DESK`, `FILECABINET`,
`SHELF`, `SOFA` and `TABLE`; `bath`, `shower`, `sink`, `toilet` and `wash-basin` to `BATH`, `SHOWER`,
`SINK`, `TOILETPAN` and `WASHHANDBASIN`.

#### Scenario: Furniture mapping

- **WHEN** a model has a `file-cabinet` furnishing
- **THEN** its `IfcFurniture` and its `IfcFurnitureType` both have `PredefinedType` `FILECABINET`

#### Scenario: Toilet maps to toilet pan

- **WHEN** a model has a `toilet` furnishing
- **THEN** its sanitary type and element have `PredefinedType` `TOILETPAN`

#### Scenario: Wash basin mapping

- **WHEN** a model has a `wash-basin` furnishing
- **THEN** its sanitary type and element have `PredefinedType` `WASHHANDBASIN`

### Requirement: Furnishing display colours

Furniture parts and sanitary parts SHALL each carry an `IfcStyledItem` surface colour, the two
colours differing from each other and each at least 0.02 away in RGB distance from every other entry
in `STYLES`, so the viewer's `styleOf` recognises each as itself and never as a wall or a slab.

#### Scenario: Furniture and fittings differ

- **WHEN** the IFC is opened in any viewer
- **THEN** a sofa and a bath appear in different colours, each distinct from walls, slabs, doors, glazing, stairs, ground and railings

#### Scenario: Furnishing material is not recognised as a wall or slab

- **WHEN** the viewer's plan style looks for the wall and slab colours among a furnishing's material
- **THEN** it finds neither, so the classifier leaves the furnishing material alone

### Requirement: No furnishings, no furnishing entities

A model with no furnishings SHALL produce no furnishing elements, furnishing types or furnishing
style items, so its IFC is exactly what the other element types alone give.

#### Scenario: Unfurnished model

- **WHEN** a model with no `furnishings` is exported
- **THEN** its IFC has no `IfcFurniture`, no `IfcSanitaryTerminal`, no `IfcFurnitureType` and no `IfcSanitaryTerminalType`
