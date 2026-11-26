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
The viewer SHALL show a revision picker beside the model picker. It SHALL list "Existing" for the
base model, then each built revision by name, and SHALL be hidden for a model with no revisions.
"Existing" SHALL be disabled when the base is not built. The choice SHALL be written to `?model=` as
`<model>@<revision>`, or `<model>` for "Existing". `?model=<model>@<revision>` SHALL open that
revision with the picker showing it. Revision names SHALL be rendered as text.

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
projection. This SHALL hold even when the URL has `?camera=` or `?view=`, which apply only when a
model is first opened. The shown storeys and the Ids toggle SHALL carry over. The ground grid and the
view buttons' framing SHALL follow the new revision's extent. Choosing a revision SHALL leave walk
mode, as choosing a model does. Choosing another model SHALL frame the camera as before.

#### Scenario: Camera stays put after orbiting
- **WHEN** the viewer was opened with `?view=sw`, the user then chose the top view, and then switches from "Existing" to a revision
- **THEN** the camera position, target and projection are exactly the top view's, not the south-west view's

#### Scenario: Camera parameter not re-applied
- **WHEN** the viewer was opened with `?camera=`, the user then orbited, and then switches revision
- **THEN** the camera stays where the user orbited to

#### Scenario: Storeys carry over
- **WHEN** only the ground storey is shown and the user switches revision
- **THEN** only the revision's ground storey is drawn and `?storeys=` is unchanged

#### Scenario: Larger revision
- **WHEN** a revision extends the footprint and the user then chooses a view button
- **THEN** the view frames the revision's whole extent

#### Scenario: Walk mode
- **WHEN** walk mode is active and the user chooses another revision in the picker
- **THEN** walk mode ends and the revision is drawn

#### Scenario: Another model
- **WHEN** the user chooses a different model in the model picker
- **THEN** the camera is framed on the new model as before

### Requirement: Revision keyboard shortcut
Arrow Right SHALL choose the next enabled entry in the revision picker, and Arrow Left the previous
one, with the same effect as choosing it. Neither SHALL wrap. The revision picker's tooltip SHALL
name the keys.

#### Scenario: Step to a revision
- **WHEN** the viewer shows "Existing" and the user presses Arrow Right
- **THEN** the first revision is drawn and the camera has not moved

#### Scenario: Step back
- **WHEN** the viewer shows the first revision and the user presses Arrow Left
- **THEN** the existing building is drawn

#### Scenario: No wrap
- **WHEN** the last revision is shown and the user presses Arrow Right
- **THEN** nothing changes

#### Scenario: Existing not built
- **WHEN** "Existing" is disabled, the first revision is shown, and the user presses Arrow Left
- **THEN** nothing changes

### Requirement: Revision shortcut scope
The revision shortcut SHALL be ignored where the storey shortcut is ignored, and for a model with no
revisions, with one difference. It SHALL work while any of the viewer's pickers has focus, and the
browser's own Arrow Left and Arrow Right handling for those pickers SHALL NOT also act.

#### Scenario: Storey selector focused
- **WHEN** the user has just chosen a floor, so the storey selector has focus, and presses Arrow Right
- **THEN** the next revision is drawn and the storey selection does not change

#### Scenario: Walk mode
- **WHEN** walk mode is active and the user presses Arrow Left or Arrow Right
- **THEN** the camera walks and the revision does not change

#### Scenario: No revisions
- **WHEN** the shown model has no revisions and the user presses Arrow Right
- **THEN** nothing changes

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
