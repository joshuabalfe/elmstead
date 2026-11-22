# Spec Delta

## ADDED Requirements

### Requirement: Constraints published for the viewer
When a model has a constraints file and `build` checks it without an ERROR, the command SHALL write
`out/<name>.constraints.json` beside the building JSON and IFC. The file SHALL list every
constraint with its id, its scope, its storey, its two resolved plan points in model millimetres,
the plan span its measurement covers, and its required distance. It SHALL NOT be written for a
model with no constraints file, or when the build writes nothing.

#### Scenario: Constraints published
- **WHEN** `build` runs on a model whose constraints are all met
- **THEN** `out/<name>.constraints.json` lists each constraint's id, scope, storey, resolved `from` and `to` points, measured span and distance

#### Scenario: No constraints file
- **WHEN** `build` runs on a model with no constraints file
- **THEN** no `out/<name>.constraints.json` is written

#### Scenario: A constraint fails
- **WHEN** `build` runs on a model that breaks a constraint
- **THEN** it writes no outputs, including no constraints JSON