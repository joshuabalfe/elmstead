# Spec Delta

## MODIFIED Requirements

### Requirement: Local, self-contained serving

The viewer SHALL serve the list of IFCs in `out/` as `/models.json`, the files in `out/`, and the
web-ifc WASM from `node_modules`, so nothing is loaded from a CDN. `ELMSTEAD_OUT_DIR` SHALL serve
another folder in place of `out/`. An IFC added to or changed in the output directory SHALL be
offered to open viewers as described in "Viewer reloads on rebuild".

#### Scenario: Rebuild while viewing

- **WHEN** `npm run build` rewrites an IFC while the viewer is open
- **THEN** the viewer updates in place, as "Viewer reloads on rebuild" requires, without reloading the page

### Requirement: Viewer reloads on rebuild

The viewer dev server SHALL notify open viewers of the rebuilt IFC's model name when an IFC in the output directory is added or changed, including by atomic rename. An on-screen model SHALL be fetched with its building and constraints JSON, converted and swapped in without navigating, holding the previous picture until complete and keeping the camera, projection and framing; in walk mode it SHALL end walk first. Measurements SHALL be cleared.

#### Scenario: Rebuilt IFC renamed into place

- **WHEN** `build` atomically renames a new IFC over the one on screen
- **THEN** the viewer shows the new model in the same session, without navigating the page

#### Scenario: Camera stays put

- **WHEN** the user has moved the camera away from its URL pose, is not walking, and the shown model is rebuilt
- **THEN** the camera position, target and projection are exactly as they were

#### Scenario: Storeys carry over

- **WHEN** only the ground storey is shown and the shown model is rebuilt
- **THEN** only the ground storey is drawn and `?storeys=` is unchanged, as on a revision switch

#### Scenario: Sidecars refresh

- **WHEN** a rebuilt model's building or constraints JSON has changed
- **THEN** labels, dimensions, constraint labels and the changes panel use the new JSON

#### Scenario: No flicker

- **WHEN** a rebuilt shown model is loading
- **THEN** every frame drawn shows either the previous model or the finished new one

#### Scenario: Measurements cleared

- **WHEN** a measurement exists and its model is rebuilt
- **THEN** every measurement and any pending point are removed, as on a model change

#### Scenario: Walk mode ends

- **WHEN** walk mode is active and the shown model is rebuilt
- **THEN** walk mode ends, restoring the pre-walk view, and the rebuilt model is drawn

### Requirement: Revisions stay loaded

Each revision of the shown model, Existing included, SHALL stay loaded once it has been shown. Showing
it again SHALL NOT fetch or convert its IFC again, and SHALL draw exactly as when it was first
loaded. Choosing another model SHALL release the previous model's revisions. An IFC that has been
rebuilt SHALL be the exception: it SHALL be released, and fetched and converted again when next
shown.

#### Scenario: Flicking back

- **WHEN** the user switches from Existing to a revision and back, then to the revision again
- **THEN** neither IFC is fetched a second time, and each picture matches the first time it was drawn

#### Scenario: Another model

- **WHEN** the user chooses another model and then the first model again
- **THEN** the first model's IFC and its revisions' IFCs are fetched again as they are shown

#### Scenario: Rebuilt revision

- **WHEN** a revision's IFC is rebuilt and the user later chooses that revision
- **THEN** the rebuilt IFC is fetched and converted, not the copy loaded before the rebuild

### Requirement: Removed elements as ghosts

In Diff mode the viewer SHALL load the base model's IFC alongside the revision. It SHALL draw only
the removed elements from it, in pale red (`#ffcecb`) and see-through, outlined in red (`#cf222e`).
If the base IFC is not in `out/`, Diff mode SHALL still colour added and changed elements, and the
status line SHALL say that removed elements need the base built.

#### Scenario: Demolished wall

- **WHEN** Diff mode is on and the revision removes `wall-rear-kitchen`
- **THEN** that wall is drawn pale red, see-through and outlined in red where it stood in the base model

#### Scenario: Only removed elements

- **WHEN** Diff mode is on
- **THEN** no element of the base model is drawn except the removed ones

#### Scenario: Base not built

- **WHEN** Diff mode is turned on and the base model's IFC is not in `out/`
- **THEN** added and changed elements are coloured, no ghosts are drawn, and the status line says to build the base model

#### Scenario: Existing after a Diff session

- **WHEN** the user turns Diff mode on for a revision, then switches to "Existing"
- **THEN** the existing building is drawn exactly as it was before Diff mode was used, with no ghost colours and no elements hidden

#### Scenario: Base loaded once

- **WHEN** "Existing" has already been shown, the base has not been rebuilt since, and the user then turns Diff mode on for a revision
- **THEN** the base model's IFC is not fetched again

#### Scenario: Rebuilt base

- **WHEN** the base model's IFC is rebuilt after "Existing" was shown
- **THEN** turning Diff mode on for a revision fetches the rebuilt base IFC, and the ghosts follow it

### Requirement: Diff follows the view

Diff colours, ghosts, the plan drawing and the panel's list SHALL follow storey visibility. Diff
mode SHALL stay on when switching between revisions of the same model, and SHALL be inactive while
"Existing" is shown, returning when a revision is chosen again. The comparison SHALL use the base
model's current building JSON, so a rebuilt base changes the diff.

#### Scenario: One storey shown

- **WHEN** Diff mode is on and only the ground storey is shown
- **THEN** only the ground storey's elements, ghosts and plan changes are drawn, and the list shows only ground-storey changes

#### Scenario: Switching revision

- **WHEN** Diff mode is on and the user switches to another revision
- **THEN** that revision is drawn in Diff mode against the base, and the camera has not moved

#### Scenario: Flicking to Existing

- **WHEN** Diff mode is on and the user switches to "Existing" and back
- **THEN** the base is drawn in normal colours, and the revision is drawn in Diff mode again

#### Scenario: Rebuilt base after Diff was off

- **WHEN** the base model is rebuilt while Diff is off and the user then turns Diff on
- **THEN** the revision is diffed against the rebuilt base, and the ghosts follow its rebuilt IFC

## ADDED Requirements

### Requirement: Unshown rebuilds refresh the pickers

The viewer SHALL leave the scene alone and refresh both pickers by re-reading `/models.json`, keeping the current selection, when a model is rebuilt that is neither on screen nor the base of a revision shown in Diff mode. A rebuilt base of a shown Diff revision SHALL instead redraw the diff and ghosts from the rebuilt IFC.

#### Scenario: Another model rebuilt

- **WHEN** an IFC that is neither on screen nor the shown revision's Diff base is rebuilt
- **THEN** the scene does not change

#### Scenario: New revision appears

- **WHEN** a build writes an IFC for a revision that did not exist when the viewer opened
- **THEN** the revision picker lists it without a page navigation, and the current selection stays

#### Scenario: Rebuilt Diff base

- **WHEN** the shown revision's base is rebuilt while Diff mode is on
- **THEN** the diff and the removed elements' ghosts are redrawn from the new base

### Requirement: Failed reload

A reload that fails SHALL report the error in the status line, keep the viewer running and draw no model until a later load succeeds. It SHALL NOT navigate or move the camera.

#### Scenario: Unreadable rebuilt IFC

- **WHEN** the rebuilt IFC cannot be fetched or converted
- **THEN** the error is reported in the status, no model is drawn, and a later successful rebuild shows a model
