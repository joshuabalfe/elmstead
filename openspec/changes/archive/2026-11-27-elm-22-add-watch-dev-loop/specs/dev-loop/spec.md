# Spec Delta

## Purpose

The local edit loop: a watch command rebuilds a model's outputs when its source files change, so an open viewer can show the change without a manual build.

## ADDED Requirements

### Requirement: Watch command

`npm run watch [paths…]` SHALL watch `models/` recursively for TypeScript changes and rebuild each affected model or revision through `build`: checks, outputs, geometry round-trip and IfcOpenShell validation. It SHALL write no plan or 3D snapshot. With no path it SHALL watch everything under `models/`; each path SHALL resolve to a model or revision, or the command SHALL print the usage and exit 2. A changed non-TypeScript file, or one outside `models/`, SHALL cause no build.

#### Scenario: Default watch

- **WHEN** `npm run watch` is running and a file under `models/elmstead/` changes
- **THEN** it rebuilds `models/elmstead` and writes the same outputs `build` writes

#### Scenario: Narrowed watch

- **WHEN** `npm run watch models/elmstead` is running and a file under `models/examples/example-cottage/` changes
- **THEN** nothing is rebuilt

#### Scenario: Unknown path

- **WHEN** `npm run watch models/elmstead models/does-not-exist` is run
- **THEN** it prints the usage and exits with status 2

#### Scenario: Startup

- **WHEN** `npm run watch` starts and no source file changes
- **THEN** it builds nothing

#### Scenario: Atomic save

- **WHEN** an editor renames a temporary file over a model's source file
- **THEN** the watcher notices it and rebuilds that model once

#### Scenario: Watcher error

- **WHEN** the filesystem watcher reports an error
- **THEN** the error is printed and the watcher re-arms and keeps running, or exits non-zero if it cannot

#### Scenario: No rendering

- **WHEN** the watcher rebuilds a model
- **THEN** no plan SVG, plan PNG or 3D snapshot is written

#### Scenario: Unrelated file

- **WHEN** a non-TypeScript file inside `models/`, or a file outside it, changes
- **THEN** nothing is rebuilt

#### Scenario: Deleted source

- **WHEN** a model source file is deleted
- **THEN** nothing is rebuilt and no output file is removed

### Requirement: Model and revision targets

A model root SHALL be the highest ancestor under `models/` containing `index.ts`; changes beneath it outside `revisions/` SHALL rebuild it. A change to `<model>/revisions/<revision>.ts` SHALL rebuild that revision; a change inside `<model>/revisions/<revision>/` SHALL rebuild that folder revision. A helper folder under `revisions/` without `index.ts` SHALL be ignored. A non-constraints TypeScript file directly under `models/` or `models/examples/` SHALL be a single-file model.

#### Scenario: Folder model helper

- **WHEN** `models/elmstead/ground/walls.ts` changes
- **THEN** the watcher builds `models/elmstead`, not `models/elmstead/ground`

#### Scenario: File revision

- **WHEN** `models/examples/example-cottage/revisions/rear-extension.ts` changes
- **THEN** the watcher builds that revision file and leaves `out/example-cottage.*` untouched

#### Scenario: Folder revision helper

- **WHEN** a helper inside `models/<model>/revisions/<revision>/` changes
- **THEN** the watcher builds that revision, not its base model

#### Scenario: Shared revision helper

- **WHEN** a file inside `models/<model>/revisions/shared/` changes and that folder has no `index.ts`
- **THEN** nothing is rebuilt; the revisions that use the helper rebuild when their own files change

#### Scenario: Single-file model

- **WHEN** `models/<name>.ts` changes
- **THEN** the watcher builds `models/<name>.ts`

#### Scenario: Base change does not cascade

- **WHEN** a base model file changes while revisions exist
- **THEN** only the base model is rebuilt; its revisions rebuild only when their own files change

### Requirement: Constraints files map to their model

A model's `constraints.ts`, a single-file model's `<name>.constraints.ts`, and a revision's `<revision>.constraints.ts` SHALL rebuild that model or revision. A constraints file SHALL NOT be treated as a model.

#### Scenario: Folder model constraints

- **WHEN** `models/elmstead/constraints.ts` changes
- **THEN** the watcher builds `models/elmstead` and re-checks its constraints

#### Scenario: Revision constraints

- **WHEN** `models/examples/example-cottage/revisions/rear-extension.constraints.ts` changes
- **THEN** the watcher builds `models/examples/example-cottage/revisions/rear-extension.ts`

#### Scenario: Single-file model constraints

- **WHEN** `models/<name>.constraints.ts` changes
- **THEN** the watcher builds `models/<name>.ts`, not a model named `<name>.constraints`

### Requirement: Debounced, serialised builds

Events for the same target within the debounce window SHALL cause one build. Builds SHALL run one at a time; a change made during a build SHALL cause one follow-up build of that target after the current build finishes.

#### Scenario: Burst of write events

- **WHEN** one save produces several filesystem events for the same model
- **THEN** the watcher runs one build, not one per event

#### Scenario: Two quick saves

- **WHEN** two saves for the same model land inside the debounce window
- **THEN** the watcher runs one build for that target

#### Scenario: Save during a build

- **WHEN** a model changes while its build is running
- **THEN** the running build finishes and one more build follows; the two never overlap

### Requirement: Build failures do not stop the watcher

A build that fails before writing SHALL leave previous outputs untouched. A build that fails after writing SHALL leave the files it wrote in place. In both cases the watcher SHALL report the issues, keep running and rebuild on the next change.

#### Scenario: Invalid model

- **WHEN** a saved model fails its checks while its outputs exist
- **THEN** the previous outputs stay in place and the watcher remains running

#### Scenario: Verification failure

- **WHEN** a saved model passes its checks but its IFC fails round-trip or IfcOpenShell validation
- **THEN** the written files stay in place, the verification issues are printed, and the watcher remains running

#### Scenario: Recovery

- **WHEN** the model is fixed and saved again after a failed build
- **THEN** the watcher builds it and writes the new outputs

#### Scenario: Model throws

- **WHEN** a saved model throws while being loaded
- **THEN** the error is printed and the watcher remains running
