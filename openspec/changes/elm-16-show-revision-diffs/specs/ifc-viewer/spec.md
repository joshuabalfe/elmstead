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
In Diff mode each added element SHALL be drawn in pale green (`#aceebb`) outlined in dark green
(`#1a7f37`), and each changed element in pale yellow (`#fae17d`) outlined in dark amber (`#9a6700`).
Glazing SHALL keep its transparency. Unchanged elements SHALL keep their normal colours.

#### Scenario: Added wall
- **WHEN** Diff mode is on and `wall-ext-north` is added by the revision
- **THEN** `wall-ext-north` is drawn pale green with a dark green outline along its edges

#### Scenario: Changed window
- **WHEN** Diff mode is on and a window is changed by the revision
- **THEN** the window is drawn pale yellow and see-through, with a dark amber outline

#### Scenario: Unchanged context
- **WHEN** Diff mode is on and Transparency is off
- **THEN** every unchanged element is drawn in its normal colours

#### Scenario: Diff off
- **WHEN** Diff mode is turned off
- **THEN** every element is drawn in its normal colours, with no outlines

### Requirement: Diff in the plan drawing
In Diff mode the plan-style drawing SHALL carry the diff, so it shows from above. Added and
changed walls SHALL be drawn in their status's dark colour; their window symbols and door gaps in
the pale colour with a dark outline; their slab and room fills in the pale colour, over the floor.

#### Scenario: Top view of an extension
- **WHEN** Diff mode is on in the top view of a revision that adds a lean-to and widens a window
- **THEN** the lean-to's walls are dark green and its floor pale green, and the window symbol is pale yellow with a dark amber outline

#### Scenario: Changed room
- **WHEN** Diff mode is on and the revision reshapes `room-living`
- **THEN** that room's floor is drawn pale yellow, and the door swings on it still show

#### Scenario: Plan without Diff
- **WHEN** Diff mode is off
- **THEN** the plan drawing is exactly the normal plan

### Requirement: Removed elements in the plan drawing
In Diff mode the plan-style drawing SHALL show what the revision removed, drawn from the base model
where it stood: walls, window symbols and door gaps in pale red (`#ffcecb`) with a dashed red
(`#cf222e`) outline, above the revision's own wall tops, so a bricked-up window shows over the wall
that now runs through it.

#### Scenario: Demolished wall from above
- **WHEN** Diff mode is on in the top view and the revision removes `wall-rear-kitchen`
- **THEN** that wall's outline is drawn pale red, dashed in red, where it stood

#### Scenario: Bricked-up window
- **WHEN** the revision removes a window from a wall it keeps
- **THEN** the window symbol is drawn in red over the wall

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
- **WHEN** "Existing" has already been shown, and the user then turns Diff mode on for a revision
- **THEN** the base model's IFC is not fetched again

### Requirement: Transparency
The viewer SHALL offer a **Transparency** button, for any model, that draws elements see-through.
In Diff mode it SHALL fade only the unchanged elements, so the changes stay solid. In plan style it
SHALL fade the plan drawing too, so it shows in the top view. `?xray=1` SHALL turn it on at load.

#### Scenario: Existing building
- **WHEN** the viewer shows a base model and the user presses **Transparency**
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

### Requirement: Shown models start clean
A model the viewer shows SHALL be drawn exactly as its current Diff and Transparency settings
require, whatever it showed before. A revision kept loaded from an earlier Diff or Transparency
session SHALL NOT keep that session's colours, fading or outlines once they are turned off.

#### Scenario: Diff turned off, then back to a revision
- **WHEN** the user views a revision in Diff mode, turns Diff off, switches to another revision and back
- **THEN** the first revision is drawn in its normal colours, with no outlines

### Requirement: Diff lands in one picture
Turning Diff mode or Transparency on or off, and switching revision with either on, SHALL keep the
previous picture drawn until the new one is complete, with its colours, outlines, fading, ghosts and
plan drawing applied. No frame SHALL show a half-applied picture.

#### Scenario: Toggling Diff
- **WHEN** the user turns Diff mode on
- **THEN** every frame drawn shows either the picture before or the finished Diff picture

#### Scenario: Toggling Transparency
- **WHEN** the user turns Transparency on
- **THEN** every frame drawn shows either the picture before or the finished see-through picture

#### Scenario: Switching with Diff on
- **WHEN** Diff mode is on and the user switches to another revision
- **THEN** every frame drawn shows either the previous revision's Diff picture or the finished new one

### Requirement: Changes panel
In Diff mode the viewer SHALL show a panel with the count of added, changed and removed elements.
Each category SHALL have a checkbox; unchecking it SHALL draw that category as unchanged, or hide
the ghosts and plan outlines for removed. Below, the panel SHALL list every change by storey, with
its status and id. Clicking one SHALL frame the camera on that element.

#### Scenario: Counts
- **WHEN** Diff mode is on for a revision that adds 7 elements, changes 3 and removes 2
- **THEN** the panel shows 7 added, 3 changed and 2 removed

#### Scenario: Hide a category
- **WHEN** the user unchecks "removed"
- **THEN** the red ghosts and red plan outlines are hidden, and added and changed elements keep their colours

#### Scenario: Fly to a change
- **WHEN** the user clicks `wall-ext-north` in the list
- **THEN** the camera frames that wall, looking in the direction it was

#### Scenario: Panel hidden
- **WHEN** Diff mode is off
- **THEN** the panel is not shown

### Requirement: Diff follows the view
Diff colours, ghosts, the plan drawing and the panel's list SHALL follow storey visibility. Diff
mode SHALL stay on when switching between revisions of the same model, and SHALL be inactive while
"Existing" is shown, returning when a revision is chosen again.

#### Scenario: One storey shown
- **WHEN** Diff mode is on and only the ground storey is shown
- **THEN** only the ground storey's elements, ghosts and plan changes are drawn, and the list shows only ground-storey changes

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
