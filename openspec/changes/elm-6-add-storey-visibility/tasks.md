# Tasks

## 1. Storey visibility

- [ ] 1.1 Parse `?storeys=` as a comma-separated list of storey ids; with an id that names no storey, show every storey and put the unknown id in the status line; verify a browser test covers one-of-two, unknown and omitted
- [ ] 1.2 Map each storey to its fragment local ids by walking `getSpatialStructure()` through containment *and* aggregation, so a hidden storey takes its stairs with it; hide the rest with `setVisible`; verify a hidden storey leaves nothing drawn, including its room labels, dimensions and wall-top planes
- [ ] 1.3 Verify switching the parameter reloads or re-shows correctly alongside a model change and a walk-mode entry, and that snapshots ignore the parameter as they ignore walk mode

## 2. Plan style that stacks

- [x] 2.1 Draw each shown storey's fills at its own elevation, writing depth, so the topmost floor hides the storeys below; verify a corner view and the top view occlude correctly on a two-storey model
- [x] 2.2 Keep slab tops discarded in plan style at every storey, and keep `?style=ifc` free of any substitution; verify the IFC-style view shows solid slabs
- [x] 2.3 Move room names and areas onto the ceiling plane with the dimensions, replacing the camera-facing billboards; verify a lower storey's labels are hidden by an upper floor and still read in that storey's own view

## 3. Walk mode on the shown storeys

- [ ] 3.1 Take the entry pose from the lowest shown storey's elevation and the shown geometry's footprint centre; verify entering walk mode with the ground storey hidden stands on the first floor

## 4. Plan-versus-3D per storey

- [x] 4.1 Compare every storey's plan with the top view of that storey alone, on the cottage and on both Elmstead storeys
- [x] 4.2 Crop the comparison to the plan's drawing area and skip pixels near a classification boundary, so sheet furniture and the two rasters' different scales do not register as disagreement
- [ ] 4.3 Root-cause the skipped elmstead ground case: the 450 mm west wall, carrying the front door's gap and swing, registers a half-metre band of mismatch against the top view at the top view's scale; then re-enable the case
- [x] 4.4 Keep the centreline regression catching its defect without depending on which tile ranks worst

## 5. Docs and verification

- [ ] 5.1 Document `?storeys=`, the single-storey plan mode and the occlusive multi-storey render in `docs/rendering.md`, including that `?style=plan` falls back to the IFC colours with several storeys shown
- [ ] 5.2 Run `npm test`, `npm run typecheck` and `npx openspec validate --all`; verify all pass
- [ ] 5.3 Eye-check in the browser on the synthesised model, or on ELM-4's `models/example-two-storey` if that has landed: the whole building from a corner and from above with the top slab solid; each storey alone as its plan; orbit out of a single-storey top view and back

## Workflow follow-up

- Archive the change after implementation and the project's review requirements are satisfied.
- Verify the archived result.
- If ELM-4 merges after this change, re-cut its ifc-viewer *Plan style* delta against this change's
  text and expect one small conflict in `applyStyle`/`patchTops`; its direction-keyed slab discard
  belongs inside the single-storey plan mode this change defines.
- The checkbox UI, and making the occlusive render the named default in the help text, are the next
  change on this primitive; a roof waits for the model to grow one.
