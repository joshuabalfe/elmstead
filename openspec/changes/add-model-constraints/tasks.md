# Tasks

## 1. Constraints file and loading

- [ ] 1.1 Add `src/constraints/schema.ts` with the strict zod schema for groups, constraints, points and measures from design.md, reusing `IdSchema`, `MmSchema` and `NonNegativeMmSchema`. Verify with schema tests for a valid file, a misspelt field, a negative distance and a fractional tolerance.
- [ ] 1.2 Add `src/constraints/index.ts` helpers (`corner`, `wallEnd`, `jamb`, `roomCorner`, `inStorey`, `inRoom`) that accept ids or model objects and build plain schema values. Verify with tests that a helper given a `Wall` produces the same value as one given its id, and that the result passes the schema.
- [ ] 1.3 Add `constraintsPath(modelPath)` and `loadConstraints(modelPath)` in `src/constraints/load.ts`: `constraints.ts` in a folder model, `<name>.constraints.ts` beside a single-file model, none if missing; evaluate, round-trip through JSON, parse, and report schema errors and duplicate constraint ids against the constraint id or file path. Verify with load tests for each layout, a missing file, a throwing file, a misspelt field and a duplicate id.

## 2. Resolving points and measuring

- [ ] 2.1 Add face resolution in `src/constraints/resolve.ts`: `left`/`right` via `faceOffsets`, compass faces translated by wall direction and rejected on diagonal walls or missing sides. Verify with tests on east-, west-, north- and south-running walls and on a diagonal wall.
- [ ] 2.2 Resolve corner, wall-end and opening points (start, end, centre; with and without a face) using `wallPoint`, with errors for unknown ids, wrong kinds and parallel faces. Verify with tests on `example-cottage` walls and a window, including that start-to-end along the wall equals the window width.
- [ ] 2.3 Resolve room corners by compass (tie within 1 mm is an error) and by vertex number (out of range is an error), with the group's room used when the room is left out and an error in a storey group. Verify with a rectangular room, an L-shaped room tie and both room-omitted cases.
- [ ] 2.4 Add the four measures (`straight`, `x`, `y`, `along` a wall), unsigned, and the storey check (both points on one storey, and on the group's storey for a storey group). Verify with tests including a diagonal wall where `along` ignores thickness, and points on two storeys.

## 3. Checking and the CLI

- [ ] 3.1 Add `checkConstraints(model, groups)` in `src/constraints/check.ts`: unknown group scopes, resolution errors, and unmet constraints as `is <m> mm, should be <d> ±<t> mm`, with the scope in the message and the default 10 mm tolerance; return the met and total counts too. Verify with tests for a met constraint, one 8 mm out at the default tolerance (met), the same with tolerance 5 (ERROR), and an unknown scope.
- [ ] 3.2 In `src/cli/index.ts`, load constraints after the model (a load failure stops the command like a model load failure), run `checkConstraints` after `checkModel` in `check`, `build`, `render` and `all`, gate on both, and print `constr  <path>: <met> of <total> met` when a file exists. Verify with CLI tests: a broken constraint writes nothing and exits 1, `check` prints model and constraint ERRORs together, and a model without a constraints file prints no `constr` line.
- [ ] 3.3 Add `models/example-cottage.constraints.ts` covering every point kind and measure, and a test that building with and without it produces byte-identical JSON and IFC. Verify with `npm test`.

## 4. Elmstead and docs

- [ ] 4.1 Add `models/elmstead/constraints.ts` with only measurements the owner has given (the front window's 2.5 m width and the fanlight sharing the front door's width), each with a `note` naming its source, grouped by room. Verify `npm run check models/elmstead` prints `constr … 2 of 2 met` and that moving the front window's jamb breaks it.
- [ ] 4.2 Document constraints in `docs/modelling.md` (file location, points, faces, measures, tolerance, groups, an example, and preferring wall-face corners over room corners) and add a `constraints` entry to `docs/architecture.md` if it lists modules. Verify the documented example matches `models/example-cottage.constraints.ts` and passes `npm run check`.
- [ ] 4.3 Add the AGENTS.md rule: when a constraint fails, change the model, not the constraint; change or add a constraint only when the user gives a measurement. Verify the rule reads in the Rules list.

## 5. Integration

- [ ] 5.1 Run `npm test`, `npm run typecheck`, `npx openspec validate --all --strict` and `npm run all models/elmstead`, and confirm `out/elmstead.building.json` and `out/elmstead.ifc` are unchanged from before this change.

## Workflow follow-up

- Archive `harden-mvp-pipeline` before archiving this change, so its specs are the baseline.
- Archive this change once it has been reviewed and merged.
