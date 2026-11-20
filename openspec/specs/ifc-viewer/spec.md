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
and `nw`, and an orthographic `top`. Snapshots SHALL show the IFC's own colours with labels off. If
Chromium is missing, render SHALL warn with the fix and still write the plans.

#### Scenario: Chromium missing
- **WHEN** Playwright's Chromium is not installed
- **THEN** render reports a WARNING suggesting `npm rebuild @playwright/browser-chromium` and exits 0 if nothing else failed

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
