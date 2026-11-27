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

The viewer dev server SHALL notify open viewers when an IFC in the output directory is added or changed, including an atomic rename. An on-screen notified model SHALL be fetched, converted and swapped in without navigating, holding the previous picture until complete and keeping the camera, projection and framing. A notified model not on screen SHALL leave the scene alone and refresh the model and revision pickers. A failed reload SHALL report the error and keep the viewer running.

#### Scenario: Rebuilt IFC renamed into place

- **WHEN** `build` atomically renames a new IFC over the one on screen
- **THEN** the viewer shows the new model in the same session, without navigating the page

#### Scenario: Camera stays put

- **WHEN** the user has moved the camera away from its URL pose and the shown model is rebuilt
- **THEN** the camera position, target and projection are exactly as they were, and the shown storeys are unchanged

#### Scenario: No flicker

- **WHEN** a rebuilt shown model is loading
- **THEN** every frame drawn shows either the previous model or the finished new one

#### Scenario: Measurements cleared

- **WHEN** a measurement exists and its model is rebuilt
- **THEN** every measurement and any pending point are removed, as on a model change

#### Scenario: Walk mode ends

- **WHEN** walk mode is active and the shown model is rebuilt
- **THEN** walk mode ends and the rebuilt model is drawn

#### Scenario: Rebuilt base in Diff mode

- **WHEN** a revision is shown in Diff mode and its base model is rebuilt
- **THEN** the diff and the removed elements' ghosts are redrawn from the new base

#### Scenario: Another model rebuilt

- **WHEN** an IFC that is not on screen is rebuilt
- **THEN** the scene does not change

#### Scenario: New revision appears

- **WHEN** a build writes an IFC for a revision that did not exist when the viewer opened
- **THEN** the revision picker lists it without a page navigation

#### Scenario: Reload failure

- **WHEN** the rebuilt IFC cannot be fetched or converted
- **THEN** the error is reported in the status and the viewer keeps running, and the next successful rebuild shows a model

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
