# Proposal

## Why

The MVP pipeline works for valid models and has strong deterministic output and verification, but
semantic mistakes that still satisfy the schema can crash the CLI, write invalid IFC, or produce
misleading diagnostics. The documented checks layer only covers door and window components, and
several advertised entry points and fallback paths are incomplete or broken.

## What Changes

- Add model-integrity checks for unique ids, opening host/fit/overlap rules and polygon validity,
  and run them before `build` or `render` writes output.
- Turn unexpected pipeline failures into normal `Issue`s instead of raw stack traces; keep `load`
  testable by returning results rather than exiting.
- Implement `npm run check` and `npm run all`.
- Make validator output parsing and the validator script path robust, and report crashes clearly.
- Resolve output, validator and viewer paths independently of the process working directory; let
  the CLI honour `ELMSTEAD_OUT_DIR`.
- Fix the 3D snapshot server leak when Chromium cannot launch, and distinguish missing Chromium
  (WARNING) from unexpected viewer failures (ERROR).
- Confine the viewer dev server to its served directories, validate `?view=`, and stop injecting
  model file names through `innerHTML`.
- Write IFC window types with an appropriate multi-panel partitioning value when the design has
  glazing rows or columns.
- Remove dead helpers/variables and enable unused-code checks; add CLI integration tests and CI.
- Write generated artefacts atomically and remove the remaining unnamed magic coordinates in the
  Elmstead model.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `model-checks`: add id uniqueness, opening host/fit/overlap, zero-length-wall and polygon-validity
  requirements; extend the build gate to `render`.
- `cli`: add `check`/`all`, the error boundary, `ELMSTEAD_OUT_DIR` support and atomic output writes.
- `ifc-verification`: make validator output parsing, script resolution and crash reporting robust.
- `ifc-export`: choose a multi-panel window type when a component has glazing.
- `ifc-viewer`: guarantee the snapshot server and browser close on every failure path, classify
  failures correctly, confine static serving and validate the requested view.

## Impact

- `src/checks/`: new integrity checks and a `checkModel` aggregator.
- `src/cli/`: command dispatch, error boundary, output directory and atomic writes.
- `src/ifc/`: validator bridge and window type partitioning.
- `src/render/`: snapshot lifecycle and error classification.
- `src/geometry/`: use the existing segment-intersection helper for polygon checks; remove dead
  helpers after the checks land.
- `viewer/`: dev-server path confinement, view validation and safe model list rendering.
- `models/elmstead/`: name the remaining absolute plan coordinates.
- `tests/`: fixtures and integration tests for checks, CLI failures and snapshot cleanup; CI
  workflow.
- No schema element types are added; the JSON contract and generated JSON Schema are unchanged.