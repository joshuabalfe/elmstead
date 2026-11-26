# Tasks

Implement after ELM-15 has merged; rebase this branch on it first.

## 1. The diff

- [x] 1.1 Add `diffModels(base, revision)` in `src/diff/` on the shared `idNodes` walk in `src/schema/ids.ts`, matching by id over walls, openings, slabs, rooms, stairs, railings, storeys (own fields only, never added or removed) and components, ordered by each model's own order; verify unit tests for added, removed, changed, moved to another storey, a renamed element, a raised storey and a revision with no edits
- [x] 1.2 Count an opening as changed when its component was changed or added, or its host wall was changed; verify tests where only the component is replaced, where a wall's start moves with its window untouched, and where a door is re-hosted on a new wall
- [x] 1.3 Verify a test that every collection `idNodes` walks is covered by the diff, so a new element type fails until it is mapped

## 2. CLI output

- [x] 2.1 Diff against the base that ELM-15's CLI already loads for a revision, and write `out/<model>@<revision>.diff.json` in `build`'s atomic output step; verify CLI tests that a file revision and a folder revision both write it, a base build does not, a failed build leaves it untouched, and two builds are byte-identical
- [x] 2.2 Print the `diff` summary line in `build`, `check` and `all` for a revision without affecting the exit status; verify CLI tests match the exact line on `models/examples/example-cottage/revisions/rear-extension.ts`
- [x] 2.3 Document the diff, what counts as changed, and the diff file in `docs/rendering.md` (or `docs/modelling.md` for the rules), with the lengthened-wall limitation

## 3. Diff colours in the viewer

- [x] 3.1 Add one function that applies the view state to a shown model: reset (`resetHighlight`, `resetOpacity`, remove the outline group), then Diff, then Transparency; run it at the end of every `load()` and on every toggle; verify a browser test that a revision viewed in Diff mode, then shown again after Diff is turned off, is drawn exactly as a fresh load
- [x] 3.2 Add the **Diff** button, `?diff=1` and the `D` key on the storey shortcut's guard, shown only for a revision; verify browser tests for on, off, a base model, a shared link and walk mode
- [x] 3.3 Highlight added and changed items in GitHub's fills (`#aceebb`, `#fae17d`), once per status with a `customId`, keeping glazing see-through; outline them in the accents (`#1a7f37`, `#9a6700`) with `EdgesGeometry` built from `getItemsGeometry`; verify a browser test samples an added wall's corner-view pixels as pale green, finds outline segments for each changed item, and that Diff off restores the normal picture pixel for pixel
- [x] 3.4 Verify a unit test that `styleOf` classifies every diff fill as no style, so `applyStyle` never patches a diff material
- [x] 3.5 Keep Diff mode across revision switches and inactive on "Existing", with the camera unmoved; verify a browser test that opens with `?view=sw`, chooses the top view, then toggles Diff and switches to "Existing" and back, and finds the top view's camera state each time (not via `?camera=`, which would hide a jump)
- [x] 3.6 Apply everything inside ELM-15's held frame, and hold the frame for a Diff or Transparency toggle too; verify a frame-sampling browser test (like ELM-15's no-flicker test) that a toggle of each, and a switch with Diff on, each draw exactly two pictures

## 4. Diff in the plan drawing

- [x] 4.1 Give `renderFloor`'s slab and room fills their element's `data-id`; verify the render tests and the plan SVG snapshot pass unchanged
- [x] 4.2 Recolour the plan drawing's nodes by id before `planGeometry`: added and changed wall pieces in the accent, window symbols and door gaps in the fill with accent strokes; verify a top-view browser test samples the lean-to's wall pixels as the added accent and the widened window's symbol as the changed fill
- [x] 4.3 Draw added and changed slab and room fills as their own floor layer, 1 mm above the floor, with the door swings above it; verify a top-view browser test samples the knocked-through room's floor as the changed fill and still finds its door swings drawn
- [x] 4.4 Draw removed walls and openings from the base storey with `renderWallTops`, filtered to the removed ids, in the removed fill with a dashed `#cf222e` outline, 2 mm above the revision's wall tops; verify a top-view browser test finds red at the demolished wall and at the bricked-up window
- [x] 4.5 Verify a browser test that the top view with Diff off is pixel-identical to the plan before this change

## 5. Removed-element ghosts

- [x] 5.1 Take the base from ELM-15's `resident` models, loading it there without showing it if Existing hasn't been shown yet; add it to the scene beside the revision with only removed items visible, in the removed fill, see-through and outlined in `#cf222e`; take it out of the scene on Diff off or a revision switch; verify browser tests that a removed wall is drawn and no other base element is, and that turning Diff on after Existing was shown fetches no IFC
- [x] 5.2 Hide ghosts by storey with the base JSON's owner map, include the ghost model in hover picking (taking the nearer hit) and leave it out of measurement snapping; verify browser tests (on the two-storey fixture, with an in-memory revision) for one storey shown, hovering a ghost, and that a measurement click on a ghost picks the geometry behind it
- [x] 5.3 Without a base IFC, colour added and changed elements and put a note in the status line; verify a browser test
- [x] 5.4 Reset the base (`resetHighlight`, `resetVisible`) before showing it as Existing; verify a browser test that Existing after a Diff session matches Existing before one, pixel for pixel

## 6. Transparency

- [x] 6.1 Add the **Transparency** button and `?xray=1`, for any model: `setOpacity(…, 0.35)` on every item Diff hasn't coloured, kept across model and revision switches; verify browser tests on Existing (every element faded), with Diff on (changes solid, the rest faded) and across a switch
- [x] 6.2 In plan style, fade the plan drawing's materials to the same opacity; verify a top-view browser test that turning Transparency on changes the picture, and off restores it pixel for pixel

## 7. Panel and hover

- [x] 7.1 Add the changes panel with per-category counts and checkboxes, and the list grouped by storey; unchecking "removed" hides both the ghosts and the plan's red outlines; verify browser tests for counts, hiding each category and following storey visibility
- [x] 7.2 Frame the camera on a clicked change, in the direction it is looking (`fitToSphere` round its `getMergedBox`; `fitToBox` would snap to the nearest face); verify a browser test that clicking an added wall in the list moves the camera onto it (the list only holds shown storeys' changes, so a hidden storey's can't be clicked)
- [x] 7.3 Add `· added`, `· changed` or `· removed` to the hover label in Diff mode; verify browser tests for an added wall and a ghost
- [x] 7.4 Document Diff mode, its colours, the plan drawing, Transparency, the panel, `D`, `?diff=1` and `?xray=1` in `docs/rendering.md`

## 8. Diff snapshots

- [x] 8.1 Have `render` on a revision run a second snapshot pass with `&diff=1`, writing `<name>.3d-diff-<view>.png` without the panel, and a WARNING when the base IFC is missing; verify a CLI test of both cases, and that a base model's render writes no Diff snapshots

## 9. Integration

- [ ] 9.1 Eye-check in the browser on `example-cottage@rear-extension`: Diff from each corner and from the top, the knocked-through wall's ghost and dashed plan outline, the lean-to in green, the widened living-room window in yellow, Transparency with and without Diff, and flicking to "Existing" and back
- [ ] 9.2 Run `npm test`, `npm run typecheck` and `npx openspec validate --all`, and regenerate any generated file the change touches; verify all pass

## Workflow follow-up

- Diff plan SVGs from `render` (the same colours on the printed plans) are the natural next change, on the same diff and the plan drawing's id recolouring.
- The floor layer's coplanar fills don't reliably stack in drawing order (found by this change's spike); root-causing that is a separate fix.
- Archive the change after implementation and review, and sync its specs into `openspec/specs/`.
