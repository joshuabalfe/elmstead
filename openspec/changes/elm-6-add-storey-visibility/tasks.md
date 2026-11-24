# Tasks

## 1. Storey visibility

- [x] 1.1 Parse `?storeys=` as a comma-separated list of storey ids; with an id that names no storey, show every storey and put the unknown id in the status line; verify a browser test covers one-of-two, unknown and omitted
- [x] 1.2 Map each fragment to its storey by the Tag the writer puts on every element, or the Name for spaces — fragments' spatial tree proved unreliable, surfacing one storey node with null localIds — and hide the rest with `setVisible`; verify a hidden storey leaves nothing drawn, including its labels, floor and constraints, and that hiding renders pixel-identically to a model without that storey
- [x] 1.3 Verify a snapshot honours the parameter, rendering only the storeys asked for, and that a model change reloads cleanly with it set

## 2. Plan style that stacks

- [x] 2.1 Draw each shown storey's fills at its own elevation, writing depth, so the topmost floor hides the storeys below; verify a corner view and the top view occlude correctly on a two-storey model
- [x] 2.2 Keep slab tops discarded in plan style at every storey, and keep `?style=ifc` free of any substitution; verify the IFC-style view shows solid slabs
- [x] 2.3 Move room names and areas onto the ceiling plane with the dimensions, replacing the camera-facing billboards; verify a lower storey's labels are hidden by an upper floor and still read in that storey's own view

## 3. Walk mode on the shown storeys

- [x] 3.1 Take the entry pose from the lowest shown storey's elevation and the shown geometry's footprint centre; verified by eye in walk mode with the ground storey hidden: the pose stands on the first floor with nothing beneath it

## 4. Plan-versus-3D per storey

- [x] 4.1 Compare every storey's plan with the top view of that storey alone, on the cottage and on both Elmstead storeys
- [x] 4.2 Crop the comparison to the plan's drawing area and skip pixels near a classification boundary, so sheet furniture and the two rasters' different scales do not register as disagreement
- [x] 4.3 Root-cause the skipped elmstead ground case and re-enable it: the band was not the west wall but the wall box's perimeter, where the two rasters' antialiased outer edges can never agree across scales; the comparison now stays three pixels inside the box, and the centreline case still catches its defect at 250 mm tiles
- [x] 4.4 Keep the centreline regression catching its defect without depending on which tile ranks worst

## 5. Docs and verification

- [x] 5.1 Document `?storeys=`, the single-storey plan mode and the occlusive multi-storey render in `docs/rendering.md`, including that `?style=plan` falls back to the IFC colours with several storeys shown
- [x] 5.2 Run `npm test`, `npm run typecheck` and `npx openspec validate --all`; verify all pass
- [x] 5.3 Eye-check in the browser on the synthesised model, or on ELM-4's `models/example-two-storey` if that has landed: the whole building from a corner and from above with the top slab solid; each storey alone as its plan; orbit out of a single-storey top view and back

## 6. Storey selector

- [x] 6.1 Add a storey select to the bar, lowest first and hidden for single-storey models; choosing a storey shows it and every storey below, hides those above, and updates the loaded model without a reload
- [x] 6.2 Write the cumulative selection to `?storeys=` (clearing it for the top storey), show a disabled custom value for a non-prefix URL subset, and leave the camera in place while updating walk entry for the lowest shown storey
- [x] 6.3 Verify a browser test pins the camera with `?camera=` and compares the selector's picture with the equivalent `?storeys=` picture, and that the topmost choice matches the all-storey picture with no parameter left
- [x] 6.4 Document the selector in `docs/rendering.md`; verify `npm test`, `npm run typecheck` and `npx openspec validate --all`

## 7. Elmstead floor structure

- [x] 7.1 Put the provisional first floor one floor structure (its 200 mm slab) above the ground ceiling, carry the external walls up through that zone so the facade stays continuous (internal walls stop at the ceiling, so the slab sits on them), and verify `build` reports 0 errors and the plan-versus-3D comparisons still pass; a stair's rise is then ceiling + joist depth, not the ceiling alone
- [x] 7.2 Draw a slab's exposed edges in plan style while suppressing only its top, and bury the first-floor slab's outer edges half a wall into the external walls (also removing its overhang outside the footprint); verify the stairwell edge shows 200 mm and no grey band crosses the facade
- [x] 7.3 Align the stairwell opening with the ground plan's room and wall edges (hallway east edge, bathroom north wall, north wall, rear hall west edge) and simplify the slab to three pieces; verify every first-floor room centroid falls on a slab and none inside the opening

## Workflow follow-up

- Archive the change after implementation and the project's review requirements are satisfied.
- Verify the archived result.
- If ELM-4 merges after this change, re-cut its ifc-viewer *Plan style* delta against this change's
  text and expect one small conflict in `applyStyle`/`patchTops`; its direction-keyed slab discard
  belongs inside the single-storey plan mode this change defines. When ELM-4 adds Elmstead's stair,
  its rise is the first-floor elevation (2.9 m clear ceiling plus the 200 mm structure), not the
  ceiling alone; ELM-4's own fixture already treats the rise as floor-to-floor.
- Per-storey checkboxes for arbitrary subsets, and making the occlusive render the named default in
  the help text, remain the next change on this primitive; a roof waits for the model to grow one.
