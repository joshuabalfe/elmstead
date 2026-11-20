# Spec Delta

## ADDED Requirements

### Requirement: Check command
`check` SHALL load the model, run every model check and print the resulting issues. It SHALL write
no files. It SHALL exit with status 1 if any ERROR was reported and 0 otherwise.

#### Scenario: Valid model
- **WHEN** `npm run check models/example-cottage.ts` is run on a valid model
- **THEN** it prints no issues, writes nothing to `out/` and exits 0

#### Scenario: Invalid model
- **WHEN** a model has an opening that does not fit its wall
- **THEN** `check` prints the ERROR against the opening and exits 1

### Requirement: All command
`all` SHALL run `build` and then `render` for the same model. It SHALL stop before rendering if the
build reports an ERROR. `--ids` and `--no-3d` SHALL affect the render step as they do for `render`.

#### Scenario: Build succeeds
- **WHEN** `npm run all models/example-cottage.ts` is run on a valid model
- **THEN** it writes the JSON, IFC, plans and snapshots and exits 0

#### Scenario: Build fails
- **WHEN** the model checks report an ERROR
- **THEN** `all` writes nothing and exits 1

### Requirement: Unexpected failures are issues
The CLI SHALL catch unexpected errors from loading, writing, rendering and validating and report
them as an ERROR issue. It SHALL NOT print a raw stack trace or leave a partially written output
file. A command SHALL exit with status 1 when such an error is reported.

#### Scenario: Writer precondition
- **WHEN** a model reaches the writer with a missing host wall
- **THEN** the CLI prints an ERROR and exits 1 without an uncaught exception

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
Each generated file SHALL be written to a temporary file and renamed into place, so an interrupted
or failed write leaves the previous version intact.

#### Scenario: Failed write
- **WHEN** writing an output file fails part way
- **THEN** the previous file at that path is unchanged

## MODIFIED Requirements

### Requirement: Commands and usage
The CLI SHALL take a command and a model path, plus optional flags. `build`, `render`, `check` and
`all` SHALL be implemented. Any other command SHALL print `unknown command` and the usage line and
exit with status 2. A missing command or model path SHALL print the usage and exit with status 2.

#### Scenario: Missing model path
- **WHEN** `npm run build` is run with no model
- **THEN** the usage line is printed and the exit status is 2

#### Scenario: Unimplemented command
- **WHEN** `npm run deploy models/example-cottage.ts` is run
- **THEN** it prints `unknown command "deploy"` and exits with status 2

#### Scenario: Check command is implemented
- **WHEN** `npm run check models/example-cottage.ts` is run
- **THEN** it runs the model checks instead of printing `unknown command`