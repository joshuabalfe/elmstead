# Spec Delta

## MODIFIED Requirements

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