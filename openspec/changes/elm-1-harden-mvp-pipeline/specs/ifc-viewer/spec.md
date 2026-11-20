# Spec Delta

## ADDED Requirements

### Requirement: Static serving is confined
The viewer dev server SHALL only serve files that resolve inside the configured output directory or
the web-ifc package directory. A request that resolves outside them SHALL be rejected with 404.

#### Scenario: Path traversal
- **WHEN** a request path encodes `..` and resolves into a sibling directory
- **THEN** the server returns 404 instead of the file

### Requirement: Requested view is validated
The viewer SHALL accept only `sw`, `se`, `ne`, `nw` and `top` for `?view=`. Any other value SHALL
fall back to `top` instead of failing to render.

#### Scenario: Unknown view
- **WHEN** the viewer is opened with `?view=sideways`
- **THEN** it shows the top view

### Requirement: Viewer reloads on rebuild
The viewer dev server SHALL reload the page when an IFC in the output directory is added or
changed, so an atomic rename is noticed as well as an in-place write.

#### Scenario: Rebuilt IFC renamed into place
- **WHEN** `build` atomically renames a new IFC over the old one
- **THEN** the viewer reloads and shows the new model

### Requirement: Model names are rendered as text
The viewer SHALL treat model names from `/models.json` as text when building the model picker, so a
file name containing markup is displayed literally.

#### Scenario: Markup in a file name
- **WHEN** `out/` contains an IFC whose name contains `<b>`
- **THEN** the picker shows that text and does not create a bold element

## MODIFIED Requirements

### Requirement: 3D snapshots
`render` SHALL start the viewer on a free port, open it in headless Chromium with `?snapshot=1`,
wait for `window.__elmsteadReady` and save a 1200 × 900 PNG per camera. The viewer server and
browser SHALL close on every success and failure path. A missing Chromium SHALL be a WARNING that
still leaves the plans written; any other viewer failure SHALL be an ERROR.

#### Scenario: Chromium missing
- **WHEN** Playwright's Chromium is not installed
- **THEN** render reports a WARNING suggesting `npm rebuild @playwright/browser-chromium`, writes the plans, closes the server and exits 0 if nothing else failed

#### Scenario: Viewer fails to load the IFC
- **WHEN** the viewer reports an error other than a missing browser
- **THEN** render reports an ERROR and exits 1 after closing the server and browser