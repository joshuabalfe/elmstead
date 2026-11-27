# Spec Delta

## ADDED Requirements

### Requirement: Viewer production build

`npm run viewer:build` SHALL write a static viewer bundle to the git-ignored `dist/` directory,
including the application code, its web worker and its styles. The bundle SHALL load no code,
style, font or model from a CDN.

#### Scenario: Building the viewer

- **WHEN** `npm run viewer:build` runs on a clean checkout
- **THEN** it exits 0 and writes the app, its worker and its styles under `dist/`

#### Scenario: No CDN

- **WHEN** the built bundle is opened
- **THEN** it requests no script, style, font or model from a remote origin

### Requirement: Preview serving

`npm run viewer:preview` SHALL serve the built bundle with `/models.json`, the IFCs in the output
directory and the web-ifc WASM from `node_modules`, honouring `ELMSTEAD_OUT_DIR` as the dev server
does. Requests SHALL be confined to those directories, and for the same URL the built viewer SHALL
show the same UI and 3D result as the dev server.

#### Scenario: Preview a model

- **WHEN** `npm run viewer:preview` is opened with `?model=` naming a built IFC
- **THEN** the built viewer loads that model and its controls behave as in `npm run view`

#### Scenario: Preview honours the output directory

- **WHEN** `ELMSTEAD_OUT_DIR` names another folder and `npm run viewer:preview` starts
- **THEN** `/models.json` and `/out/*` serve that folder

#### Scenario: Preview confinement

- **WHEN** a preview request path encodes `..` and resolves into a sibling directory
- **THEN** the preview server returns 404 instead of the file
