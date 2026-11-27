# Spec Delta

## ADDED Requirements

### Requirement: Viewer navigation

The viewer SHALL group its controls into Model, Camera and Tools sections in a left-hand navigation
rail. Each row SHALL keep its label on the left and its control on the right. Persistent settings
SHALL use switches labelled with the setting they change, and each switch's track SHALL read the
current state, Off or On. Unavailable controls SHALL stay visible and disabled, and enabled controls
SHALL have a visible affordance.

#### Scenario: Grouped controls

- **WHEN** the viewer opens
- **THEN** the model and revision pickers and Levels controls are under Model, the camera snaps and Walk under Camera, and the constraints, ids, Measure and Clear controls under Tools

#### Scenario: Unavailable controls stay visible

- **WHEN** the shown model has no revisions
- **THEN** the Revision picker and Revision Diff switch are visible and disabled

#### Scenario: Switch state

- **WHEN** a persistent setting is off, then turned on
- **THEN** its switch track reads Off, then On

### Requirement: Camera snaps follow true north

The viewer SHALL offer isometric camera snaps for true north, west, east and south, plus Top. Each
snap SHALL look from its named true direction, using the model's `northAngle`, at the same isometric
elevation as the plan-corner views. Its label SHALL be N, W, E or S and SHALL NOT turn with the
model. The `?view=` values `n`, `e`, `s` and `w` SHALL select these snaps; `sw`, `se`, `ne` and `nw`
SHALL keep their plan-corner views and snapshot names as before.

#### Scenario: Turned model

- **WHEN** the viewer loads a model whose `northAngle` is 153°
- **THEN** the N, W, E and S snaps look from true north, west, east and south, and their labels stay N, W, E and S

#### Scenario: No north angle

- **WHEN** the viewer loads a model with no `northAngle`
- **THEN** the cardinal snaps look from plan north, west, east and south

#### Scenario: Plan-corner links

- **WHEN** the viewer is opened with `?view=ne` on a turned model
- **THEN** it still shows the plan's north-east corner view

### Requirement: Flat elevations

The viewer SHALL offer flat orthographic elevations Front, Back, Left and Right around the model's
front. Front SHALL look from `site.frontAngle`, the front's outward direction counter-clockwise
from plan +y and defaulting to 180 (plan south). Back SHALL be opposite; Left and Right SHALL be the
sides seen when facing the front. The elevations SHALL NOT turn with `northAngle`, and
`?view=front|back|left|right` SHALL select them.

#### Scenario: A set front angle

- **WHEN** the model's `frontAngle` is 90, so the front faces plan west
- **THEN** Front looks from plan west, Back from plan east, Left from plan north and Right from plan south

#### Scenario: Front angle omitted

- **WHEN** the model has no `frontAngle`
- **THEN** Front looks from plan south

## MODIFIED Requirements

### Requirement: Annotations from the model

When labels are on, the viewer SHALL read `out/<name>.building.json` and draw, at each storey's
ceiling (10 mm above its tallest wall):

- the plan's room and overall dimensions, lying flat;
- room names and areas as camera-facing sprites;
- a compass pointing to true north.

Labels SHALL be on by default and off in snapshots. The **Show Labels** switch or `?labels=0|1` SHALL
toggle them.

#### Scenario: Snapshot labels

- **WHEN** the viewer is opened with `?snapshot=1`
- **THEN** no room labels or dimensions are drawn

### Requirement: Constraint visibility

Constraint labels and lines SHALL follow the **Show Constraints** switch and `?constraints=0|1`,
independently of the **Show Labels** switch and `?labels=0|1`. They SHALL be hidden by default,
interactively and in rendered snapshots, and SHALL show only when the switch is on or
`?constraints=1` is given.

#### Scenario: Default

- **WHEN** the viewer opens with no `constraints` override
- **THEN** no constraint labels or lines are drawn

#### Scenario: Constraints toggle

- **WHEN** the user turns **Show Constraints** on, or opens the viewer with `?constraints=1`
- **THEN** the constraint labels and lines appear

#### Scenario: Constraints off

- **WHEN** the user turns **Show Constraints** off, or opens the viewer with `?constraints=0`
- **THEN** no constraint labels or lines are drawn

#### Scenario: Labels toggle leaves constraints alone

- **WHEN** constraints are on and the user turns room labels off, or opens the viewer with `?labels=0`
- **THEN** the constraint labels and lines remain visible

#### Scenario: Snapshot

- **WHEN** the viewer is opened with `?snapshot=1` and no `constraints` override
- **THEN** no constraint labels or lines are drawn

### Requirement: Storey selector

The viewer SHALL offer a vertical slider of the storeys, lowest first, one notch each and the highest
at the top. Choosing one SHALL show it and every storey below, hiding those above, without moving the
camera. The selection SHALL be written to `?storeys=` as the ids it shows, and the topmost storey
SHALL clear the parameter. A `?storeys=` set that is not a floor's prefix SHALL show a custom value
until a floor is chosen. The slider SHALL be shown for every model, disabled with one storey.

#### Scenario: Choosing a floor

- **WHEN** the viewer shows a two-storey model and the user chooses the ground storey
- **THEN** only the ground storey is drawn, with its labels and floor

#### Scenario: Everything below

- **WHEN** the user chooses the topmost storey
- **THEN** every storey is drawn, the URL has no `storeys` parameter, and the camera has not moved

#### Scenario: Camera stays put

- **WHEN** the user changes the selection
- **THEN** the camera, projection and framing stay exactly as they were, and only the drawn storeys differ

#### Scenario: Shared view

- **WHEN** the viewer is opened with `?storeys=storey-ground,storey-first-floor`
- **THEN** the selector shows the first floor and both storeys are drawn

#### Scenario: Another floor chosen mid-change

- **WHEN** the user chooses a second floor before the first change has finished
- **THEN** the viewer eases from where it is to the second floor, and it ends exactly as if that floor had been chosen alone

#### Scenario: With Transparency

- **WHEN** Transparency is on and the user chooses another floor
- **THEN** the floor change is swept as usual, with the entering and leaving storeys fading to and from the see-through opacity

#### Scenario: Upper storey alone

- **WHEN** the viewer is opened with `?storeys=` naming only an upper storey
- **THEN** that storey alone is drawn and the selector shows a custom value

#### Scenario: Single storey

- **WHEN** the shown model has a single storey
- **THEN** the selector shows that storey and is disabled

### Requirement: Storey shortcut scope

The storey shortcut SHALL be ignored in walk mode, where the arrows keep walking, with Ctrl, Alt, Meta or Shift held, for a single-storey model, in snapshot mode, and while a text field, a select or a textarea has focus. While the storey selector has focus the shortcut SHALL still step it, and the browser's own arrow-key handling for it SHALL NOT also act. The selector's tooltip SHALL name the keys.

#### Scenario: Walk mode

- **WHEN** walk mode is active and the user presses Arrow Up or Arrow Down
- **THEN** the camera walks and the storey selection does not change

#### Scenario: Single storey

- **WHEN** the model has one storey and the user presses Arrow Up or Arrow Down
- **THEN** nothing changes

#### Scenario: Held key

- **WHEN** the user holds Arrow Down on a three-storey model
- **THEN** the selection keeps stepping down at the auto-repeat rate until the key is released or the lowest storey is shown

#### Scenario: Selector focused

- **WHEN** the user has just chosen a floor from the selector, which keeps focus, and presses Arrow Down
- **THEN** the selector steps down exactly one floor

#### Scenario: Other control focused

- **WHEN** the model selector has focus and the user presses Arrow Up
- **THEN** the storey selection does not change

#### Scenario: Modifier held

- **WHEN** the user presses Shift+Arrow Up
- **THEN** the storey selection does not change

### Requirement: Ids toggle

The viewer SHALL provide a **Show IDs on Hover** switch that toggles hover identification, and `?ids=0|1` SHALL
set it at load. Hover identification SHALL start off. Snapshots SHALL ignore the switch and the
parameter.

#### Scenario: Ids button on

- **WHEN** the user turns **Show IDs on Hover** on
- **THEN** hover identification turns on and the switch shows it is on

#### Scenario: Ids button off

- **WHEN** the user turns **Show IDs on Hover** off while hover identification is on
- **THEN** hover identification turns off and any tooltip is hidden

#### Scenario: URL entry

- **WHEN** the viewer is opened with `?ids=1`
- **THEN** hover identification starts on

#### Scenario: Default

- **WHEN** the viewer is opened without `ids` in the URL
- **THEN** hover identification is off and hovering shows no tooltip

#### Scenario: Model change does not re-enable the URL parameter

- **WHEN** the user turns hover identification off and then selects another model, with `?ids=1` in the URL
- **THEN** hover identification stays off

#### Scenario: Snapshot

- **WHEN** the viewer is opened with `?snapshot=1&ids=1`
- **THEN** no tooltip or Ids control is shown and the snapshot is unchanged

### Requirement: Revision picker

The viewer SHALL show a revision picker below the model picker. It SHALL list "Existing" for the
base model, then each built revision by name, and SHALL be shown but disabled for a model with no
revisions. "Existing" SHALL be disabled when the base is not built. The choice SHALL be written to `?model=` as
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
- **THEN** the revision picker shows "Existing" and is disabled

#### Scenario: Base not built

- **WHEN** only revisions of the shown model have been built
- **THEN** "Existing" is listed but disabled

### Requirement: Diff mode

The viewer SHALL offer a **Revision Diff** switch, shown for every model and disabled while no
revision is shown, that toggles Diff mode. `?diff=1` SHALL turn it on at load, and turning it off
SHALL remove the parameter. The `D` key SHALL toggle it, ignored where the storey shortcut is
ignored, or when no revision is shown.

#### Scenario: Turning Diff on

- **WHEN** the viewer shows `elmstead@rear-extension` and the user turns **Revision Diff** on
- **THEN** Diff mode turns on, the switch shows it is on, and the URL has `diff=1`

#### Scenario: Existing building

- **WHEN** the viewer shows a base model
- **THEN** the **Revision Diff** switch is disabled and `D` does nothing

#### Scenario: Shared link

- **WHEN** the viewer is opened with `?model=elmstead@rear-extension&diff=1`
- **THEN** the revision is drawn in Diff mode

#### Scenario: Camera stays put

- **WHEN** Diff mode is turned on or off
- **THEN** the camera, projection and framing are exactly as they were

### Requirement: Transparency

The viewer SHALL offer a **Transparency** switch, for any model, that draws elements see-through.
In Diff mode it SHALL fade only the unchanged elements, so the changes stay solid. In plan style it
SHALL fade the plan drawing too, so it shows in the top view. `?xray=1` SHALL turn it on at load.

#### Scenario: Existing building

- **WHEN** the viewer shows a base model and the user turns **Transparency** on
- **THEN** every element is drawn see-through, and the URL has `xray=1`

#### Scenario: With Diff

- **WHEN** Diff mode and Transparency are both on
- **THEN** added and changed elements are drawn solid in their diff colours, and every other element is see-through

#### Scenario: Top view

- **WHEN** Transparency is turned on in the top view in plan style
- **THEN** the plan drawing is drawn faded, and the picture changes

#### Scenario: Kept across switches

- **WHEN** Transparency is on and the user switches revision or chooses Existing
- **THEN** the newly shown model is drawn see-through too

### Requirement: Project orientation override

`?orient=project` SHALL make the viewer ignore `northAngle` when it orients its views. The Top view
SHALL keep plan +y up, and the N, W, E and S snaps SHALL align with the plan axes while keeping
their labels. The compass SHALL still point to true north. Any other value, or none, SHALL mean true
north orientation.

#### Scenario: Project-oriented Top view

- **WHEN** the viewer is opened with `?view=top&orient=project` on a model whose `northAngle` is 135°
- **THEN** plan +y points up the screen and the compass points 135° counter-clockwise from up

#### Scenario: Project-oriented camera snaps

- **WHEN** the viewer is opened with `?orient=project` on a model whose `northAngle` is 135°
- **THEN** the N snap stands on plan +y and the W snap on plan −x, and their labels stay N and W

#### Scenario: Unknown orientation

- **WHEN** the viewer is opened with `?orient=sideways`
- **THEN** it orients its views to true north

## REMOVED Requirements

### Requirement: Corner buttons name their true direction

**Reason**: The plan-corner buttons were labelled by compass name, so their labels did not describe the direction they looked from, and the flat views could not follow the building's front.

**Migration**: Use the N, W, E and S true-north snaps, or the Front, Back, Left and Right flat elevations. `?view=sw|se|ne|nw` keeps its plan-corner meaning for links and snapshots.
