# Tasks

Implement after ELM-15 has merged; rebase this branch on it first.

## 1. The diff

- [ ] 1.1 Add `diffModels(base, revision)` in `src/diff/`, matching by id over walls, openings, slabs, rooms, stairs, railings, storeys (own fields only) and components, ordered by each model's own order; verify unit tests for added, removed, changed, moved to another storey, a renamed element, a new storey and a revision with no edits
- [ ] 1.2 Count an opening whose component was changed or added as changed; verify a test where only the component is replaced
- [ ] 1.3 Verify a test that every id-bearing schema collection is covered by the diff, so a new element type fails until it is mapped

## 2. CLI output

- [ ] 2.1 Load a revision's base from its folder, and write `out/<model>@<revision>.diff.json` in `build`'s atomic output step; verify CLI tests that a revision build writes it, a base build does not, a failed build leaves it untouched, and two builds are byte-identical
- [ ] 2.2 Print the `diff` summary line in `build`, `check` and `all` for a revision without affecting the exit status; verify CLI tests match the exact line on ELM-15's `example-two-storey` revision
- [ ] 2.3 Document the diff, what counts as changed, and the diff file in `docs/rendering.md` (or `docs/modelling.md` for the rules), with the lengthened-wall limitation

## 3. Diff colours in the viewer

- [ ] 3.1 Spike: on `example-two-storey`, `highlight` added, changed and unchanged items in plan style and IFC style, and confirm that per-item highlight survives plan style's material patching; record the outcome in this task before building on it
- [ ] 3.2 Add the **Diff** button, `?diff=1` and the `D` key on the storey shortcut's guard, shown only for a revision; verify browser tests for on, off, a base model, a shared link and walk mode
- [ ] 3.3 Colour added and changed items and fade unchanged ones through Fragments, and pass a per-id colour map to the plan-style overlays; verify a browser test samples an added wall's top-view pixels as green and an unchanged wall's as faded, and that Diff off restores the normal picture pixel for pixel
- [ ] 3.4 Keep Diff mode across revision switches and inactive on "Existing", with the camera unmoved; verify a browser test with `?camera=` pinned

## 4. Removed-element ghosts

- [ ] 4.1 Load the base IFC as a second Fragments model in Diff mode, under the load epoch, show only removed items in red and see-through, cache it for the model group, and dispose it on a model change or Diff off; verify a browser test that a removed wall is drawn and no other base element is
- [ ] 4.2 Hide ghosts by storey with the base JSON's owner map, include the ghost model in hover picking and leave it out of measurement snapping; verify browser tests for one storey shown, hovering a ghost, and that a measurement click on a ghost picks the geometry behind it
- [ ] 4.3 Without a base IFC, colour added and changed elements and put a note in the status line; verify a browser test

## 5. Panel and hover

- [ ] 5.1 Add the changes panel with per-category counts and checkboxes, and the list grouped by storey; verify browser tests for counts, hiding a category and following storey visibility
- [ ] 5.2 Frame the camera on a clicked change with `fitToBox`, first showing its storey if hidden; verify a browser test on a change on a hidden storey
- [ ] 5.3 Add `· added`, `· changed` or `· removed` to the hover label in Diff mode; verify browser tests for an added wall and a ghost
- [ ] 5.4 Document Diff mode, its colours, the panel, `D` and `?diff=1` in `docs/rendering.md`

## 6. Diff snapshots

- [ ] 6.1 Have `render` on a revision run a second snapshot pass with `&diff=1`, writing `<name>.3d-diff-<view>.png` without the panel, and a WARNING when the base IFC is missing; verify a CLI test of both cases, and that a base model's render writes no Diff snapshots

## 7. Integration

- [ ] 7.1 Eye-check in the browser on `example-two-storey@lean-to`: Diff from each corner and from the top, a single storey, flicking to "Existing" and back, and that the transparency reads cleanly
- [ ] 7.2 Run `npm test`, `npm run typecheck` and `npx openspec validate --all`, and regenerate any generated file the change touches; verify all pass

## Workflow follow-up

- Diff plan drawings (existing grey, new hatched, demolished red dashed) are the natural next change on `diff.json`.
- Archive the change after implementation and review, and sync its specs into `openspec/specs/`.
