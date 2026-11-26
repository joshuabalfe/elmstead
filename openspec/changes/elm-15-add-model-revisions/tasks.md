# Tasks

## 1. The `revise` helper

- [ ] 1.1 Add `revise(base, edits)` with `remove`, `replace`, `add`, `addStorey` and `addComponent` to `src/model/`, cloning the base and keeping replaced elements in place; verify unit tests cover each edit, that the base object is unchanged afterwards, and the order edits apply in
- [ ] 1.2 Infer an added element's collection from its shape in one function beside the schema; verify a test fails if any schema collection is left unmapped
- [ ] 1.3 Make an unknown id, a duplicate id, a kind or id mismatch on `replace`, and an unknown storey throw an error naming the id; verify each case reports one ERROR through `loadModel`, and that an orphaned opening is reported by the existing host-wall check
- [ ] 1.4 Document writing a revision in `docs/modelling.md`, with the edit list and the no-cascade rule; verify the example in the doc type-checks as written

## 2. Naming and the CLI

- [ ] 2.1 Make `modelName` return `<model>@<revision>` for `<folder>/revisions/<revision>.ts`, and reject a non-kebab-case revision name; verify unit tests for a revision path, a base folder, `index.ts` and a single-file model
- [ ] 2.2 Verify a CLI test that `build` on a revision writes `<model>@<revision>.building.json` and `.ifc` into `ELMSTEAD_OUT_DIR`, passes the round-trip and validation, and leaves the base's outputs untouched; and that `render` names the plans and snapshots the same way

## 3. Constraints for revisions

- [ ] 3.1 List the ids each constraint references: points, the host wall of an opening point, and the group's room or storey scope; verify unit tests over every point kind
- [ ] 3.2 Check a revision against the base's constraints whose referenced elements are present and serialise identically, skipping the rest; verify tests for an untouched element (checked, and an unmet one is an ERROR), a removed element and a replaced element (both skipped)
- [ ] 3.3 Load `revisions/<revision>.constraints.ts` when it exists and check it on that revision only; verify the base build never reads it
- [ ] 3.4 Print the inherited summary with its skipped count and a second line for the revision's own file, and write `<model>@<revision>.constraints.json` without skipped constraints; verify CLI tests match the spec's exact summary lines and the JSON contents
- [ ] 3.5 Document revision constraints in `docs/modelling.md#constraints`, including that a revision constraint must come from a real proposal measurement with a `note`

## 4. Example revision

- [ ] 4.1 Add `models/example-two-storey/constraints.ts` with a handful of constraints, some on elements the revision keeps and some on ones it changes; verify `npm run build models/example-two-storey` still reports 0 errors
- [ ] 4.2 Add `models/example-two-storey/revisions/lean-to.ts`: remove a window, widen another, and add a single-storey lean-to with a door through the existing wall; verify `npm run all models/example-two-storey/revisions/lean-to.ts` passes, with the expected skipped count

## 5. Viewer

- [ ] 5.1 Group `/models.json` names by the part before `@`; list models once in the model picker, and add a revision picker ("Existing" first, then revisions by name) hidden for a model with none, rendering names as text; verify browser tests for a model with revisions, one without, and one with only a revision built
- [ ] 5.2 Write the choice to `?model=` and open `?model=<model>@<revision>` with both pickers set; verify a browser test of the shared link
- [ ] 5.3 Give `load` a keep-view path for revision switches that keeps the camera, projection, `?storeys=` (dropping storeys the revision lacks) and Ids mode, and clears measurements; verify a browser test pins the camera with `?camera=`, switches revision, and finds the camera state unchanged and the storey selection carried over
- [ ] 5.4 Add Arrow Left and Arrow Right on the storey shortcut's guard, with the revision picker as its own exception, and name the keys in its tooltip; verify browser tests for stepping, no wrap, walk mode and a model without revisions
- [ ] 5.5 Document the revision picker, the shortcut and `?model=<model>@<revision>` in `docs/rendering.md`

## 6. Integration

- [ ] 6.1 Eye-check in the browser: open `example-two-storey`, switch to `lean-to` from a corner view with one storey shown, and back with the arrows, with no camera jump
- [ ] 6.2 Run `npm test`, `npm run typecheck` and `npx openspec validate --all`, and regenerate any generated file the change touches; verify all pass

## Workflow follow-up

- ELM-16 builds the diff on this change's naming, the `revise` id index and the viewer's revision picker.
- Archive the change after implementation and review, and sync its specs into `openspec/specs/`.
