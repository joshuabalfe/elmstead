# ifc-viewer Specification

## Purpose
A local browser viewer for the IFC files in `out/` (`viewer/`, ThatOpen components and three.js,
served by Vite). It is used interactively (`npm run view`) and headless, for the 3D snapshots and
the plan-versus-3D test.

## Requirements

### Requirement: Local, self-contained serving
The viewer SHALL serve the list of IFCs in `out/` as `/models.json`, the files in `out/`, and the
web-ifc WASM from `node_modules`, so nothing is loaded from a CDN. `ELMSTEAD_OUT_DIR` SHALL serve
another folder in place of `out/`. `npm run view` SHALL reload the page when an IFC in `out/`
changes.

#### Scenario: Rebuild while viewing
- **WHEN** `npm run build` rewrites an IFC while the viewer is open
- **THEN** the page reloads with the new model

### Requirement: Faithful IFC geometry
The viewer SHALL keep IFC coordinates unchanged (no move to the origin). It SHALL draw every item
as full geometry, never as LOD lines. In the scene Y SHALL be up and plan north SHALL be −Z.

#### Scenario: Close-up of a window
- **WHEN** the camera is close to a window with glazing bars
- **THEN** the bars and frame are drawn as solids, not lines

### Requirement: 3D snapshots
`render` SHALL start the viewer on a free port and open it in headless Chromium through Playwright
with `?snapshot=1`. For each camera it SHALL wait for `window.__elmsteadReady` and save a
1200 × 900 PNG to `out/<name>.3d-<view>.png`. The cameras SHALL be perspective `sw`, `se`, `ne`
and `nw`, and an orthographic `top`. Snapshots SHALL show the IFC's own colours with labels off.
The viewer server and browser SHALL close on every success and failure path. A missing Chromium
SHALL be a WARNING that still leaves the plans written; any other viewer failure SHALL be an ERROR.

#### Scenario: Chromium missing
- **WHEN** Playwright's Chromium is not installed
- **THEN** render reports a WARNING suggesting `npm rebuild @playwright/browser-chromium`, writes the plans, closes the server and exits 0 if nothing else failed

#### Scenario: Viewer fails to load the IFC
- **WHEN** the viewer reports an error other than a missing browser
- **THEN** render reports an ERROR and exits 1 after closing the server and browser

### Requirement: Annotations from the model
When labels are on, the viewer SHALL read `out/<name>.building.json` and draw, at each storey's
ceiling (10 mm above its tallest wall):
- the plan's room and overall dimensions, lying flat;
- room names and areas as camera-facing sprites;
- a compass pointing to true north.

Labels SHALL be on by default and off in snapshots. The **Labels** button or `?labels=0|1` SHALL
toggle them.

#### Scenario: Snapshot labels
- **WHEN** the viewer is opened with `?snapshot=1`
- **THEN** no room labels or dimensions are drawn

### Requirement: Plan style
Interactively, the viewer SHALL use a plan style:
- the plan's room fills and door swings drawn under the model as the floor;
- wall tops and sills in the plan's charcoal, unlit;
- the plan's wall pieces, door gaps and window symbols 5 mm above the wall tops;
- a white background and no grid.

`?style=ifc` or `?style=plan` SHALL force a style.

#### Scenario: Top view
- **WHEN** the interactive viewer shows the top view
- **THEN** it reads like the plan drawing without cutting the model

### Requirement: Plan and 3D agree
The test suite SHALL build each model, render the viewer's top view, and compare it with the plan
in overlapping 500 mm tiles. Pixels are classified as wall, room fill or paper. A tile SHALL fail
above 10% mismatch, and failures SHALL be reported in metres from the outer walls' south-west
corner.

#### Scenario: Room outline on a wall centreline
- **WHEN** a room outline runs to a wall's centreline instead of its face
- **THEN** the plan-versus-3D test fails on the affected tiles

### Requirement: Custom camera
`?camera=px,py,pz,tx,ty,tz` SHALL place a perspective camera at p looking at t, in scene metres.

#### Scenario: Camera parameter
- **WHEN** the viewer is opened with a `camera` parameter
- **THEN** the view starts from that position and target

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
