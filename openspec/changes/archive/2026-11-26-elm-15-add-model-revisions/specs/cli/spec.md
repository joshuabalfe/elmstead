# Spec Delta

## MODIFIED Requirements

### Requirement: Commands and usage
The CLI SHALL take a command and a model path, plus optional flags. `build`, `render`, `check` and
`all` SHALL be implemented. Any other command SHALL print `unknown command` and the usage line and
exit with status 2. A missing command or model path SHALL print the usage and exit with status 2.

#### Scenario: Missing model path
- **WHEN** `npm run build` is run with no model
- **THEN** the usage line is printed and the exit status is 2

#### Scenario: Unimplemented command
- **WHEN** `npm run deploy models/examples/example-cottage` is run
- **THEN** it prints `unknown command "deploy"` and exits with status 2

#### Scenario: Check command is implemented
- **WHEN** `npm run check models/examples/example-cottage` is run
- **THEN** it runs the model checks instead of printing `unknown command`

### Requirement: Build
`build` SHALL load the model and run the model checks. If they report an ERROR, it SHALL stop
without writing anything. Otherwise it SHALL:
1. write `out/<name>.building.json`;
2. write `out/<name>.ifc` from the same validated model;
3. run the geometry round-trip and IfcOpenShell validation.

#### Scenario: Valid model
- **WHEN** `npm run build models/examples/example-cottage` is run on a valid model
- **THEN** it writes `out/example-cottage.building.json` and `out/example-cottage.ifc`, prints a line each for json, ifc, geometry and validation, and exits 0

#### Scenario: Component check fails
- **WHEN** an opening's `componentId` does not exist
- **THEN** `build` prints the ERROR, writes no JSON or IFC, and exits 1

### Requirement: Check command
`check` SHALL load the model, run every model check and print the resulting issues. It SHALL write
no files. It SHALL exit with status 1 if any ERROR was reported and 0 otherwise.

#### Scenario: Valid model
- **WHEN** `npm run check models/examples/example-cottage` is run on a valid model
- **THEN** it prints no issues, writes nothing to `out/` and exits 0

#### Scenario: Invalid model
- **WHEN** a model has an opening that does not fit its wall
- **THEN** `check` prints the ERROR against the opening and exits 1

### Requirement: All command
`all` SHALL run `build` and then `render` for the same model. It SHALL stop before rendering if the
build reports an ERROR. `--ids` and `--no-3d` SHALL affect the render step as they do for `render`.

#### Scenario: Build succeeds
- **WHEN** `npm run all models/examples/example-cottage` is run on a valid model
- **THEN** it writes the JSON, IFC, plans and snapshots and exits 0

#### Scenario: Build fails
- **WHEN** the model checks report an ERROR
- **THEN** `all` writes nothing and exits 1

