# Spec Delta

## Purpose

The local edit loop: a watch command rebuilds a model's outputs when its source files change, so an open viewer can show the change without a manual build.

## ADDED Requirements

### Requirement: Watch command

`npm run watch [paths…]` SHALL watch `models/` recursively for TypeScript changes and rebuild each affected model or revision through the same stages as `build`: checks, building JSON, IFC, geometry round-trip and IfcOpenShell validation. It SHALL write no plan drawings or 3D snapshots. With no path it SHALL watch every model; with paths it SHALL validate them and watch only those, exiting 2 if none maps. Non-TypeScript files and paths outside `models/` SHALL be ignored.

#### Scenario: Default watch

- **WHEN** `npm run watch` is running and a file under `models/elmstead/` changes
- **THEN** it rebuilds `models/elmstead` and writes `out/elmstead.building.json` and `out/elmstead.ifc`

#### Scenario: Narrowed watch

- **WHEN** `npm run watch models/elmstead` is running and a file under `models/examples/example-cottage/` changes
- **THEN** nothing is rebuilt

#### Scenario: Unknown path

- **WHEN** `npm run watch models/does-not-exist` is run
- **THEN** it prints the usage and exits with status 2

#### Scenario: Atomic save

- **WHEN** an editor renames a temporary file over a model's source file
- **THEN** the watcher notices it and rebuilds that model once

#### Scenario: Watcher error

- **WHEN** the filesystem watcher reports an error
- **THEN** the error is printed and the watcher keeps running

#### Scenario: No rendering

- **WHEN** the watcher rebuilds a model
- **THEN** no plan SVG, plan PNG or 3D snapshot is written

#### Scenario: Unrelated file

- **WHEN** a file outside `models/`, or a non-TypeScript file inside it, changes
- **THEN** nothing is rebuilt

### Requirement: Source changes map to model targets

A model root SHALL be the outermost folder under `models/` containing `index.ts`; changes beneath it SHALL rebuild it. A change to `<model>/revisions/<revision>.ts` SHALL rebuild that file revision; a change inside `<model>/revisions/<revision>/` SHALL rebuild that folder revision. A helper folder under `revisions/` without `index.ts` SHALL be ignored. A TypeScript file directly under `models/` or `models/examples/` SHALL be a single-file model.

#### Scenario: Folder model helper

- **WHEN** `models/elmstead/ground/walls.ts` changes
- **THEN** the watcher builds `models/elmstead`, writing `out/elmstead.*`, not `models/elmstead/ground`

#### Scenario: Folder model constraints

- **WHEN** `models/elmstead/constraints.ts` changes
- **THEN** the watcher builds `models/elmstead` and its constraints are re-checked

#### Scenario: File revision

- **WHEN** `models/examples/example-cottage/revisions/rear-extension.ts` changes
- **THEN** the watcher builds that revision file, writing `out/example-cottage@rear-extension.*`, and leaves `out/example-cottage.*` untouched

#### Scenario: Revision constraints

- **WHEN** `models/examples/example-cottage/revisions/rear-extension.constraints.ts` changes
- **THEN** the watcher builds `models/examples/example-cottage/revisions/rear-extension.ts`

#### Scenario: Folder revision helper

- **WHEN** a helper inside `models/<model>/revisions/<revision>/` changes
- **THEN** the watcher builds that revision, not its base model

#### Scenario: Shared revision helper

- **WHEN** a file inside `models/<model>/revisions/shared/` changes and that folder has no `index.ts`
- **THEN** nothing is rebuilt; the revisions that use the helper rebuild when their own files change

#### Scenario: Single-file model

- **WHEN** `models/<name>.ts` changes
- **THEN** the watcher builds `models/<name>.ts`, and a change to its `<name>.constraints.ts` builds it too

#### Scenario: Base change does not cascade

- **WHEN** a base model file changes while revisions exist
- **THEN** only the base model is rebuilt; the revisions are left for their own builds

### Requirement: Debounced, serialised builds

Save events SHALL be debounced so one save causes one build. Builds SHALL run one at a time; a change made during a build SHALL cause one follow-up build of that target after the current build finishes.

#### Scenario: Burst of write events

- **WHEN** one save produces several filesystem events for the same model
- **THEN** the watcher runs one build, not one per event

#### Scenario: Save during a build

- **WHEN** a model changes while its build is running
- **THEN** the running build finishes and one more build follows; the two never overlap

### Requirement: Failed builds keep the last good outputs

A build that fails before writing SHALL leave the previous outputs untouched. A build that fails after writing SHALL leave the written outputs in place. In both cases the watcher SHALL print the issues, keep running and build the target again on its next change.

#### Scenario: Invalid model

- **WHEN** a saved model fails its checks while `out/<model>.ifc` exists
- **THEN** the previous IFC stays in place and the watcher remains running

#### Scenario: Verification failure

- **WHEN** a saved model passes its checks but its IFC fails round-trip or IfcOpenShell validation
- **THEN** the written IFC stays in place, the verification issues are printed, and the watcher remains running

#### Scenario: Recovery

- **WHEN** the model is fixed and saved again after a failed build
- **THEN** the watcher builds it and writes the new outputs

#### Scenario: Model throws

- **WHEN** a saved model throws while being loaded
- **THEN** the error is printed and the watcher remains running
