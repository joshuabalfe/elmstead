# cli Specification

## Purpose
The command-line entry point (`src/cli/index.ts`, run through `npm run <command>`) that loads a
model, runs the pipeline stages and reports issues.

## Requirements

### Requirement: Commands and usage
The CLI SHALL take a command and a model path, plus optional flags. `build` and `render` SHALL be
implemented. Any other command, including `check` and `all`, SHALL print `unknown command` and the
usage line and exit with status 2. A missing command or model path SHALL print the usage and exit
with status 2.

#### Scenario: Missing model path
- **WHEN** `npm run build` is run with no model
- **THEN** the usage line is printed and the exit status is 2

#### Scenario: Unimplemented command
- **WHEN** `npm run check models/example-cottage.ts` is run
- **THEN** it prints `unknown command "check"` and exits with status 2

### Requirement: Build
`build` SHALL load the model and run the model checks. If they report an ERROR, it SHALL stop
without writing anything. Otherwise it SHALL:
1. write `out/<name>.building.json`;
2. re-read and re-parse that file;
3. write `out/<name>.ifc` from it;
4. run the geometry round-trip and IfcOpenShell validation.

#### Scenario: Valid model
- **WHEN** `npm run build models/example-cottage.ts` is run on a valid model
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
