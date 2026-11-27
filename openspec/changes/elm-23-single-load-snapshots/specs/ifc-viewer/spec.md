# Spec Delta

## MODIFIED Requirements

### Requirement: Snapshot capture

`render` SHALL start the viewer on a free port and open it through Playwright with `?snapshot=1`
once per snapshot variant (plain; Diff for a revision), with the first camera's `?view=`. For the
first camera it SHALL wait for `window.__elmsteadReady` and save a 1200 × 900 PNG to
`out/<name>.3d-<view>.png` (Diff: `out/<name>.3d-diff-<view>.png`). Each later camera SHALL be drawn
by switching the view in the same page. The viewer server and browser SHALL close on every success
and failure path.

#### Scenario: Snapshots written

- **WHEN** `render` runs on a model that builds
- **THEN** it writes a 1200 × 900 `out/<name>.3d-<view>.png` for each camera and leaves no viewer server or browser running

#### Scenario: One page load per variant

- **WHEN** `render` writes a base model's five snapshots
- **THEN** the viewer page loads once, and the four later cameras are drawn by switching the view in that page

#### Scenario: A revision's two variants

- **WHEN** `render` writes a revision's plain and Diff snapshots
- **THEN** the viewer page loads once per variant, each with its first camera's view, and every later camera of that variant is drawn in the same page

## ADDED Requirements

### Requirement: Snapshot view switching

For each camera after the first, `render` SHALL switch the view in the loaded page and wait for
`window.__elmsteadViews` to count the settled choice before saving its PNG. The viewer SHALL
increment `window.__elmsteadViews` after a view choice has been applied and drawn, and SHALL expose
the view choice to the snapshot driver as `window.__elmsteadChooseView`.

#### Scenario: View settled before capture

- **WHEN** a snapshot camera is switched in the loaded page
- **THEN** the PNG is saved only after `window.__elmsteadViews` counts that choice, so the picture is the finished view

#### Scenario: Interactive view choice

- **WHEN** the user chooses a corner or Top view interactively
- **THEN** the viewer applies it and counts it in `window.__elmsteadViews` once it has drawn
