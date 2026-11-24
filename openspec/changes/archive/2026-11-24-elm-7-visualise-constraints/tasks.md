# Tasks

## 1. Publish resolved constraints

- [x] 1.1 Add a `ResolvedConstraint` record (id, scope, storey, resolved `from` and `to` points, measured span, required distance) and a `resolved` list on `ConstraintsReport`; populate it in `checkConstraints` as each constraint measures. Verify `tests/constraints.test.ts` covers the resolved points and span and that the existing met/total counts are unchanged.
- [x] 1.2 Make `build` write `out/<name>.constraints.json` with `formatJson` when the model has a constraints file and the checks pass, and write nothing extra otherwise. Verify a CLI test reads the file's ids, storeys, points, spans and distances, and that an unconstrained model and a failed constraint write no such file.
- [x] 1.3 Update the existing CLI tests' expected output file lists and add `out/<name>.constraints.json` to the generated-files table in `docs/development.md`. Verify `npm run test:fast` passes and no test still expects the old file list.

## 2. Draw red constraint labels

- [x] 2.1 Add the constraint red to `src/render/style.ts` and a pure `viewer/constraints.ts` helper that filters resolved constraints by storey, groups identical midpoints and formats each label as `<id> <distance>`. Verify new unit tests in `tests/viewer.test.ts` cover filtering, grouping and text.
- [x] 2.2 Load `out/<name>.constraints.json` in the viewer's label loading, build a haloed red billboard at each measured span's midpoint at the storey's label height, and add it to a constraints group above the room labels. Verify by building `models/example-cottage` and using `npm run view` in the Top and a corner view with constraints on and off, plus `?snapshot=1` with no constraints.
- [x] 2.3 Draw a thick red dotted `Line2` along each constraint's measured span at the label height, over the model and room labels but below the red labels. Verify with `npm run view` in the Top and a corner view that the measurable spans appear, and that constraints off and `?snapshot=1` remove them.
- [x] 2.4 Update the Labels and Constraints button tooltips and the viewer documentation (`docs/rendering.md`, `docs/getting-started.md`, and the constraints section of `docs/modelling.md`) to say constraints are shown in red as labels and dotted lines under their own button. Verify the docs describe the behaviour you observed and `npm run typecheck` passes.
- [x] 2.5 Add a **Constraints** button and `?constraints=0|1` controlling the constraint group independently of **Labels**; constraints default off, Labels stays on, and snapshots show neither. Verify with `npm run view` that the default view has no constraints, each button leaves the other layer alone, `?labels=0` keeps constraints visible, `?constraints=0` hides them, and `?snapshot=1` shows neither.

## 3. Integration

- [x] 3.1 Run `npm run build models/example-cottage`, `npm run build models/elmstead`, and `npm run all models/example-cottage --no-3d`; verify each constraints JSON is present and matches the model, the plan colours and 3D snapshots are unchanged, and no generated file was edited by hand. Run `npm test` and `npm run typecheck`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.