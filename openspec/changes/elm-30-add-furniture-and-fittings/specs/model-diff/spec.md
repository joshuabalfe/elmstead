# Spec Delta

## ADDED Requirements

### Requirement: Furnishings are compared

The diff SHALL list a furnishing like any other storey element: added when only the revision has its
id, removed when only the base has it, and changed when its JSON differs or its storey differs, with
the kind `furnishing` and its storey.

#### Scenario: Added furnishing

- **WHEN** a revision adds `sofa-living` to the ground storey
- **THEN** the diff lists `sofa-living` as added, of kind `furnishing`, on that storey

#### Scenario: Moved furnishing

- **WHEN** a revision changes the `at` of `table-kitchen`
- **THEN** the diff lists `table-kitchen` as changed

#### Scenario: Removed furnishing

- **WHEN** a revision removes `bed-main`
- **THEN** the diff lists `bed-main` as removed
