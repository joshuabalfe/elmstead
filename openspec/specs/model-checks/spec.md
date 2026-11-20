# model-checks Specification

## Purpose
Cross-element rules that the schema cannot express, run on the validated model before any output is
written (`src/checks/`). So far these cover door and window components.

## Requirements

### Requirement: Unique component ids
Door and window component ids SHALL be unique across both lists.

#### Scenario: Same id in doors and windows
- **WHEN** a door component and a window component share an id
- **THEN** an ERROR "component id is used twice" is reported against that id

### Requirement: Openings reference a component of their own kind
An opening's `componentId`, when present, SHALL name a component of the same kind: doors name door
components and windows name window components. Openings without a `componentId` SHALL be allowed.

#### Scenario: Unknown component
- **WHEN** a window's `componentId` is not in `components`
- **THEN** an ERROR "componentId … is not in components" is reported against the window

#### Scenario: Wrong kind
- **WHEN** a door's `componentId` names a window component
- **THEN** an ERROR "componentId … is a window component" is reported against the door

### Requirement: Windows leave room for glass
For each window with a design, twice the frame width plus the glazing bars SHALL be less than the
window's width across and its height up. The bars count as (panes − 1) × bar width in each
direction.

#### Scenario: Frame and bars too wide
- **WHEN** a 300 mm wide window uses a design with a 100 mm frame and three columns of panes with 60 mm bars
- **THEN** an ERROR against the window says the frame and bars leave no glass across

### Requirement: Checks gate the build
`build` SHALL run the model checks before writing any output and SHALL write nothing if they report
an ERROR.

#### Scenario: Failing check
- **WHEN** any model check reports an ERROR
- **THEN** no file in `out/` is written or changed by that build
