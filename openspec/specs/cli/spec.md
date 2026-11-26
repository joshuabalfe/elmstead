# cli Specification

## Purpose
The command-line entry point (`src/cli/index.ts`, run through `npm run <command>`) that loads a
model, runs the pipeline stages and reports issues.

## Requirements

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

### Requirement: Render
`render` SHALL write a plan SVG and PNG for each storey. It SHALL then write 3D snapshots from
`out/<name>.ifc`, unless `--no-3d` is given. With `--ids`, element ids SHALL be drawn on the plans.
If there is no IFC yet, it SHALL warn and skip the snapshots.

#### Scenario: Render before build
- **WHEN** `render` runs and `out/<name>.ifc` does not exist
- **THEN** the plans are written and a WARNING says the 3D snapshots were skipped, run build first

### Requirement: Issue reporting and exit status
Every problem SHALL be an issue with a level (ERROR, WARNING or INFO), an optional element id and
a message. It SHALL be printed as `<LEVEL padded to 7> <id or -> : <message>`. A command SHALL exit
with status 1 if any ERROR was reported and 0 otherwise. A model that fails to load SHALL print its
issues and `FAILED  <path>: model did not validate`, then exit with status 1.

#### Scenario: Warnings only
- **WHEN** a run reports only WARNINGs
- **THEN** the exit status is 0

### Requirement: Deterministic JSON output
`out/<name>.building.json` SHALL use two-space indentation and end with a newline. Objects and
arrays made only of primitives SHALL go on one line when that line is at most 72 characters.
Undefined fields SHALL be omitted.

#### Scenario: Point formatting
- **WHEN** a model is written to JSON
- **THEN** each point appears as `{ "x": …, "y": … }` on one line, so moving one point is a one-line diff

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

### Requirement: Unexpected failures are issues
The CLI SHALL catch unexpected pipeline errors from loading, writing, rendering and validating and
report them as a single ERROR issue. A pipeline failure SHALL NOT print a raw stack trace. A model
evaluation error SHALL keep its stack inside the issue message, because it is the most useful part
for the model author. A command SHALL exit with status 1 when such an error is reported.

#### Scenario: Writer precondition
- **WHEN** a model reaches the writer with a missing host wall
- **THEN** the CLI prints an ERROR and exits 1 without an uncaught exception

#### Scenario: Model throws
- **WHEN** a model file throws while being evaluated
- **THEN** the CLI reports one ERROR whose message contains the model's stack trace

#### Scenario: Validator output is not JSON
- **WHEN** the validator prints a non-JSON line on stdout
- **THEN** the CLI reports an ERROR describing that line instead of throwing

### Requirement: Output directory
The CLI SHALL write to `ELMSTEAD_OUT_DIR` when it is set, and otherwise to `out/` at the project
root. Commands SHALL behave the same when run from any working directory.

#### Scenario: Temporary output directory
- **WHEN** `ELMSTEAD_OUT_DIR` names a temporary directory
- **THEN** every generated JSON, IFC, SVG and PNG file is written there

#### Scenario: Run from another directory
- **WHEN** the CLI is invoked from a directory other than the project root
- **THEN** it still finds the validator and viewer and writes to the project's output directory

### Requirement: Atomic output files
Each generated file SHALL be written to a temporary file with a per-process name and renamed into
place, so an interrupted or failed write leaves the previous version intact and the temporary file
is removed. `build` SHALL generate the JSON and IFC in memory before writing either file, so a
writer failure leaves both previous versions intact.

#### Scenario: Failed write
- **WHEN** writing an output file fails part way
- **THEN** the previous file at that path is unchanged and no temporary file is left behind

#### Scenario: IFC writer fails
- **WHEN** the IFC writer throws after the JSON has been generated
- **THEN** neither the JSON nor the IFC in the output directory changes
