# Spec Delta

## MODIFIED Requirements

### Requirement: Components as types
Each door component SHALL be an `IfcDoorType` (`DOOR`, operation `NOTDEFINED`). Each window
component SHALL be an `IfcWindowType` (`WINDOW`): `SINGLE_PANEL` for one pane, `MULTIPLE_PANEL`
for more. Its instances SHALL carry the same value. Types SHALL carry the component name and id,
be declared in the project and be linked to their openings.

#### Scenario: Shared design
- **WHEN** two windows of different sizes name the same window component
- **THEN** both are instances of one `IfcWindowType`

#### Scenario: Glazed front window
- **WHEN** a window component has three columns and two rows of panes
- **THEN** its `IfcWindowType` and instances use `MULTIPLE_PANEL`

#### Scenario: Plain window
- **WHEN** a window component has no glazing
- **THEN** its `IfcWindowType` and instances use `SINGLE_PANEL`