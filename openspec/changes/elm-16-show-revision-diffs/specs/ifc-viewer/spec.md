# Spec Delta

## ADDED Requirements

### Requirement: Diff mode
The viewer SHALL offer a **Diff** button, shown only while a revision is shown, that toggles Diff
mode. `?diff=1` SHALL turn it on at load, and turning it off SHALL remove the parameter. The `D` key
SHALL toggle it, ignored where the storey shortcut is ignored, or when no revision is shown.

#### Scenario: Turning Diff on
- **WHEN** the viewer shows `elmstead@rear-extension` and the user presses **Diff**
- **THEN** Diff mode turns on, the button shows it is active, and the URL has `diff=1`

#### Scenario: Existing building
- **WHEN** the viewer shows a base model
- **THEN** the **Diff** button is hidden and `D` does nothing

#### Scenario: Shared link
- **WHEN** the viewer is opened with `?model=elmstead@rear-extension&diff=1`
- **THEN** the revision is drawn in Diff mode

#### Scenario: Camera stays put
- **WHEN** Diff mode is turned on or off
- **THEN** the camera, projection and framing are exactly as they were

### Requirement: Diff colours
In Diff mode, using the revision's diff, added elements SHALL be drawn green and changed elements
amber. Unchanged elements SHALL be drawn faded and partly see-through. The colours SHALL apply to
the IFC geometry and to the plan-style wall tops and room fills drawn for those elements.

#### Scenario: Added wall
- **WHEN** Diff mode is on and `wall-ext-north` is added by the revision
- **THEN** `wall-ext-north` is drawn green, its wall top included in plan style

#### Scenario: Changed window
- **WHEN** Diff mode is on and a window is changed by the revision
- **THEN** the window is drawn amber

#### Scenario: Unchanged context
- **WHEN** Diff mode is on
- **THEN** every unchanged element is drawn faded and partly see-through, so changed elements behind it show through

#### Scenario: Diff off
- **WHEN** Diff mode is turned off
- **THEN** every element is drawn in its normal colours again

### Requirement: Removed elements as ghosts
In Diff mode the viewer SHALL load the base model's IFC alongside the revision. It SHALL draw only
the removed elements from it, red and see-through, in place. If the base IFC is not in `out/`, Diff
mode SHALL still colour added and changed elements, and the status line SHALL say that removed
elements need the base built.

#### Scenario: Demolished wall
- **WHEN** Diff mode is on and the revision removes `wall-rear-kitchen`
- **THEN** that wall is drawn red and see-through where it stood in the base model

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
- **WHEN** "Existing" has already been shown, and the user then turns Diff mode on for a revision
- **THEN** the base model's IFC is not fetched again

### Requirement: Diff lands in one picture
Turning Diff mode on or off, and switching revision with Diff mode on, SHALL keep the previous
picture drawn until the new one is complete, with its diff colours, faded elements and ghosts
applied. No frame SHALL show the revision in its normal colours on the way to its diff colours.

#### Scenario: Toggling Diff
- **WHEN** the user turns Diff mode on
- **THEN** every frame drawn shows either the picture before or the finished Diff picture

#### Scenario: Switching with Diff on
- **WHEN** Diff mode is on and the user switches to another revision
- **THEN** every frame drawn shows either the previous revision's Diff picture or the finished new one

### Requirement: Changes panel
In Diff mode the viewer SHALL show a panel with the count of added, changed and removed elements.
Each category SHALL have a checkbox; unchecking it SHALL draw that category as unchanged, or hide
the ghosts for removed. Below, the panel SHALL list every change by storey, with its status and
id. Clicking one SHALL frame the camera on that element.

#### Scenario: Counts
- **WHEN** Diff mode is on for a revision that adds 7 elements, changes 3 and removes 2
- **THEN** the panel shows 7 added, 3 changed and 2 removed

#### Scenario: Hide a category
- **WHEN** the user unchecks "removed"
- **THEN** the red ghosts are hidden and added and changed elements keep their colours

#### Scenario: Fly to a change
- **WHEN** the user clicks `wall-ext-north` in the list
- **THEN** the camera frames that wall, and the storey selection shows its storey if it was hidden

#### Scenario: Panel hidden
- **WHEN** Diff mode is off
- **THEN** the panel is not shown

### Requirement: Diff follows the view
Diff colours, ghosts and the panel's list SHALL follow storey visibility. Diff mode SHALL stay on
when switching between revisions of the same model, and SHALL be inactive while "Existing" is shown,
returning when a revision is chosen again.

#### Scenario: One storey shown
- **WHEN** Diff mode is on and only the ground storey is shown
- **THEN** only the ground storey's elements and ghosts are drawn, and the list shows only ground-storey changes

#### Scenario: Switching revision
- **WHEN** Diff mode is on and the user switches to another revision
- **THEN** that revision is drawn in Diff mode against the base, and the camera has not moved

#### Scenario: Flicking to Existing
- **WHEN** Diff mode is on and the user switches to "Existing" and back
- **THEN** the base is drawn in normal colours, and the revision is drawn in Diff mode again

### Requirement: Hover shows diff status
In Diff mode, the hover label SHALL add the element's status to its id when the element is added,
changed or removed, for example `wall-ext-north · added`. A ghost SHALL be identified as its
removed base element.

#### Scenario: Hover an added wall
- **WHEN** hover identification and Diff mode are on and the pointer rests over an added wall
- **THEN** the label reads the wall's id followed by `· added`

#### Scenario: Hover a ghost
- **WHEN** the pointer rests over a removed wall's ghost
- **THEN** the label reads that wall's id followed by `· removed`

### Requirement: Diff snapshots
`render` on a revision SHALL also save a Diff-mode snapshot for each snapshot camera, to
`out/<name>.3d-diff-<view>.png`, with no changes panel. Snapshots of a base model SHALL be unchanged.
If the base IFC is missing, `render` SHALL write the Diff snapshots without ghosts and report a
WARNING.

#### Scenario: Revision render
- **WHEN** `render` runs on a built revision whose base is built
- **THEN** it writes the five normal snapshots and five `<name>.3d-diff-<view>.png` snapshots with ghosts

#### Scenario: Base render
- **WHEN** `render` runs on a base model
- **THEN** no Diff snapshots are written

#### Scenario: Base missing
- **WHEN** `render` runs on a revision whose base IFC is not in `out/`
- **THEN** the Diff snapshots are written without ghosts and a WARNING says to build the base model
