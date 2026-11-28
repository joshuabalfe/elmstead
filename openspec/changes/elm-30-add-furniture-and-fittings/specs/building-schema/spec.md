# Spec Delta

## MODIFIED Requirements

### Requirement: Fixed set of element types

The schema SHALL describe a building as one project, one site, one building, optional door and
window components, and at least one storey. Each storey SHALL hold only walls, openings (doors and
windows), slabs, rooms, optional stairs, optional railings and optional furnishings. The schema SHALL
carry `schemaVersion: 1`.

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

#### Scenario: Storey with furnishings

- **WHEN** a storey has a valid `furnishings` array
- **THEN** schema validation passes

#### Scenario: Storey without furnishings

- **WHEN** a storey omits `furnishings`
- **THEN** schema validation passes
