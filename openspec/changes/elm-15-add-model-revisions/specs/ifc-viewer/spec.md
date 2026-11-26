# Spec Delta

## ADDED Requirements

### Requirement: Revisions grouped by model
The viewer SHALL treat a `/models.json` name of the form `<model>@<revision>` as a revision of
`<model>`. The model picker SHALL list each model once, without its revisions, including a model
for which only revisions have been built.

#### Scenario: Model with revisions
- **WHEN** `out/` holds `elmstead.ifc` and `elmstead@rear-extension.ifc`
- **THEN** the model picker lists `elmstead` once and does not list `elmstead@rear-extension`

#### Scenario: Only a revision built
- **WHEN** `out/` holds `elmstead@rear-extension.ifc` but no `elmstead.ifc`
- **THEN** the model picker lists `elmstead`, and choosing it shows the revision

### Requirement: Revision picker
The viewer SHALL show a revision picker beside the model picker, listing "Existing" for the base
model and then each built revision by name. It SHALL be hidden for a model with no revisions. The
choice SHALL be written to `?model=` as `<model>@<revision>`, or `<model>` for "Existing", and
`?model=<model>@<revision>` SHALL open that revision with the picker showing it. Revision names
SHALL be rendered as text.

#### Scenario: Choosing a revision
- **WHEN** the viewer shows `elmstead` and the user chooses `rear-extension`
- **THEN** the revision is drawn and the URL's `model` parameter is `elmstead@rear-extension`

#### Scenario: Back to the existing building
- **WHEN** the user chooses "Existing"
- **THEN** the base model is drawn and the URL's `model` parameter is `elmstead`

#### Scenario: Shared link
- **WHEN** the viewer is opened with `?model=elmstead@rear-extension`
- **THEN** the model picker shows `elmstead`, the revision picker shows `rear-extension`, and the revision is drawn

#### Scenario: No revisions
- **WHEN** the shown model has no revisions in `out/`
- **THEN** the revision picker is hidden

#### Scenario: Base not built
- **WHEN** only revisions of the shown model have been built
- **THEN** "Existing" is listed but disabled

### Requirement: Switching revisions keeps the view
Choosing another revision of the same model SHALL load it without moving the camera or changing the
projection. The shown storeys SHALL carry over, dropping any storey the new revision lacks; if none
remain, every storey SHALL be shown. The Ids toggle SHALL stay as it was. Choosing another model SHALL
frame the camera as it does today.

#### Scenario: Camera stays put
- **WHEN** the user switches from "Existing" to a revision
- **THEN** the camera position, target, projection and framing are exactly as they were

#### Scenario: Storeys carry over
- **WHEN** only the ground storey is shown and the user switches to a revision that has it
- **THEN** only the revision's ground storey is drawn and `?storeys=` is unchanged

#### Scenario: Storey the revision lacks
- **WHEN** `?storeys=` names a storey that the chosen revision does not have
- **THEN** that storey is dropped from the selection, and every storey is shown if none remain

#### Scenario: Another model
- **WHEN** the user chooses a different model in the model picker
- **THEN** the camera is framed on the new model as before

### Requirement: Revision keyboard shortcut
Arrow Right SHALL choose the next entry in the revision picker and Arrow Left the previous one, with
the same effect as choosing it. Neither SHALL wrap. The shortcut SHALL be ignored in the cases that
the storey shortcut is ignored, with the revision picker in place of the storey selector, and for a
model with no revisions. The revision picker's tooltip SHALL name the keys.

#### Scenario: Step to a revision
- **WHEN** the viewer shows "Existing" and the user presses Arrow Right
- **THEN** the first revision is drawn and the camera has not moved

#### Scenario: Step back
- **WHEN** the viewer shows the first revision and the user presses Arrow Left
- **THEN** the existing building is drawn

#### Scenario: No wrap
- **WHEN** the last revision is shown and the user presses Arrow Right
- **THEN** nothing changes

#### Scenario: Walk mode
- **WHEN** walk mode is active and the user presses Arrow Left or Arrow Right
- **THEN** the camera walks and the revision does not change

## MODIFIED Requirements

### Requirement: Measurements follow their model
Changing the model SHALL remove every measurement and any pending point. Choosing another revision counts as changing the model. Entering walk mode SHALL also remove them. Changing the camera view SHALL NOT remove them.

#### Scenario: Model change
- **WHEN** the user selects another model
- **THEN** every measurement and any pending point are removed

#### Scenario: Revision change
- **WHEN** the user chooses another revision of the same model
- **THEN** every measurement and any pending point are removed

#### Scenario: Walk mode
- **WHEN** the user enters walk mode
- **THEN** every measurement and any pending point are removed

#### Scenario: View change
- **WHEN** the user chooses another camera view
- **THEN** the measurements stay and stay aligned with the model
