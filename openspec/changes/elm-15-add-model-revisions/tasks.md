# Tasks

## 1. Example models

- [x] 1.1 Move `models/example-two-storey/` to `tests/fixtures/two-storey/` and update its imports in the six tests and `fixtures/bad-stair.ts`, and the stair example in `docs/modelling.md`; verify `npm test` passes with the same test count
- [x] 1.2 Move `models/example-cottage/` to `models/examples/example-cottage/` and update `README.md`, `docs/`, the tests and their fixtures; verify `npm test` passes, the outputs are still named `example-cottage`, and `git grep "models/example-cottage"` finds nothing outside `openspec/changes/archive/`

## 2. One id index

- [x] 2.1 Extract `indexIds(model)` into `src/schema/ids.ts`, giving each id's kind, collection and element, and use it in `checkIds` and constraint resolution in place of `idEntries` and `indexModel`; verify the existing check and constraint tests pass unchanged, and a unit test covers every id-bearing collection

## 3. The `revise` helper

- [ ] 3.1 Add `revise(base, edits)` with `remove`, `replace`, `add(storeyId, { walls, openings, ... })` and `addComponents` to `src/model/`, cloning the base and keeping replaced elements at their index; verify unit tests cover each edit, the order edits apply in, and that the base object is unchanged afterwards
- [ ] 3.2 Make an unknown id, a duplicate id, an unknown storey, a storey id passed to `remove` or `replace`, and a replacement that the collection's schema rejects each fail loading with one ERROR naming the id; verify each case through `loadModel`, and that an orphaned opening is reported by the existing host-wall check
- [ ] 3.3 Document writing a revision in `docs/modelling.md`: the edits, the no-cascade rule, not mutating base modules, the moved-wall-start hazard for openings, and when to make the base parametric instead; verify the doc's examples type-check as written

## 4. Naming and the CLI

- [ ] 4.1 Make `modelName` return `<model>@<revision>` for `revisions/<r>.ts`, `revisions/<r>/` and `revisions/<r>/index.ts` when the parent folder has an `index.ts`, and reject a non-kebab-case name with an ERROR; verify unit tests for each form, a nested base (`models/examples/example-cottage`), a folder under `revisions/` without `index.ts`, and the unchanged base and single-file cases
- [ ] 4.2 Load the base for a revision and report an ERROR for each missing or extra storey id; verify a CLI test with a hand-built revision that has an extra storey writes nothing and exits 1
- [ ] 4.3 Verify CLI tests that `build` on a file revision and on a folder revision writes `<model>@<revision>.building.json` and `.ifc` into `ELMSTEAD_OUT_DIR`, passes the round-trip and validation, and leaves the base's outputs untouched; and that `render` names the plans and snapshots the same way

## 5. Revision constraints

- [ ] 5.1 For a revision without its own constraints file, check the base's constraints file unchanged, and add "remove or replace it in `<revision constraints path>`" to the ERROR for a failing base constraint; verify CLI tests for an untouched revision (all met) and a revision that removes a measured wall (an ERROR naming the wall and the path, nothing written)
- [ ] 5.2 Add `reviseConstraints(base, edits)` with `removeConstraint(id, note)`, `replaceConstraint` and `addGroups`, failing on an unknown id, a duplicate id or an empty note; verify unit tests for each edit and each failure
- [ ] 5.3 Load the revision's own constraints file through the existing `constraintsPath` for both revision forms, and never for the base; verify the base build never reads it
- [ ] 5.4 Print the summary naming the supplying file, with removed, replaced and added counts for a revision's own file, and write `<model>@<revision>.constraints.json` with the checked constraints; verify CLI tests match both of the spec's summary lines exactly
- [ ] 5.5 Document revision constraints in `docs/modelling.md#constraints`: inheriting by default, explicit edits, notes on removals, and real sources for added or replaced measurements

## 6. Example revision

- [ ] 6.1 Add `models/examples/example-cottage/revisions/rear-extension.ts`: knock through the living room and kitchen, remove `window-kitchen`, add a lean-to with a doorway through `wall-north`, and widen `window-bedroom`; verify `npm run check` on it fails on the broken base constraints before 6.2
- [ ] 6.2 Add `revisions/rear-extension.constraints.ts`, removing the invalidated constraints with notes and adding one illustrative extension dimension; verify `npm run all models/examples/example-cottage/revisions/rear-extension.ts` passes with the expected summary line

## 7. Viewer

- [ ] 7.1 Group `/models.json` names by the part before `@`. List models once in the model picker, and add a revision picker ("Existing" first, then revisions by name) that is hidden for a model with none, renders names as text, and disables "Existing" when the base isn't built; verify browser tests for a model with revisions, one without, and one with only a revision built
- [ ] 7.2 Write the choice to `?model=` and open `?model=<model>@<revision>` with both pickers set; verify a browser test of the shared link
- [ ] 7.3 Give `load` a keep-view path for revision switches. It updates `box`, the grid and the compass from the new model, skips `setView` and the `?camera=` re-application, keeps `?storeys=` and Ids mode, clears measurements, and leaves walk mode first. Verify browser tests that open with `?view=sw`, choose the top view, switch revision and find the top view's camera state; that open with `?camera=`, move the camera, switch, and find it unmoved; and that a view button then frames the revision's larger extent
- [ ] 7.4 Add Arrow Left and Arrow Right on the storey shortcut's guard, working from any focused picker with the browser default prevented, skipping a disabled "Existing", and naming the keys in the picker's tooltip; verify browser tests for stepping, no wrap, the disabled entry, the focused storey selector (the storey unchanged), walk mode and a model without revisions
- [ ] 7.5 Document the revision picker, the shortcut and `?model=<model>@<revision>` in `docs/rendering.md`

## 8. Integration

- [ ] 8.1 Eye-check in the browser: open `example-cottage`, switch to `rear-extension` from a corner view with one storey shown, and back with the arrows, with no camera jump
- [ ] 8.2 Run `npm test`, `npm run typecheck` and `npx openspec validate --all`, and regenerate any generated file the change touches; verify all pass

## Workflow follow-up

- ELM-16 builds the diff on this change's naming, the `indexIds` index and the revision picker. Its proposal still names `example-two-storey`, and allows added storeys; revise it to use `example-cottage@rear-extension`, to assume the same storeys, and to count an opening as changed when its host wall changed.
- Archive the change after implementation and review, and sync its specs into `openspec/specs/`.
