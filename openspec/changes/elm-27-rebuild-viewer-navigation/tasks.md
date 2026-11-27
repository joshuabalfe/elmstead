# Tasks

The implementation landed in PR #77 before this change was written; the checked tasks record the
work and how it was verified.

## 1. Front angle metadata

- [x] 1.1 Add optional `site.frontAngle` to `SiteSchema`, documenting the front's outward direction counter-clockwise from plan +y with a default of 180; set Elmstead to 90 and the example cottage to 180; verify `npm run typecheck` and the Elmstead orientation test.
- [x] 1.2 Regenerate `schema/building.schema.json` with `npm run schema`; verify the committed-schema test in `tests/schema.test.ts` passes.
- [x] 1.3 Rebuild the models and confirm the new field changes no IFC or plan output; verify `npm run build models/elmstead` reports every constraint met and a valid IFC.

## 2. Camera views

- [x] 2.1 Add `CARDINALS`, `ELEVATIONS`, `CameraView` and `CAMERA_VIEWS` to `src/shared/render/views.ts`, keep the plan-corner `VIEWS` for snapshots, and teach `parseView` the new ids; verify `tests/viewer.test.ts` covers every accepted `?view=` value and defaults unknown values to Top.
- [x] 2.2 Extend `cameraForView` with `northAngle` and `frontAngle`: true-north isometric cardinals, front-relative flat elevations, true-north-up Top, and unchanged corner cameras; verify the turned-model and Elmstead-front unit tests.
- [x] 2.3 Load `northAngle` and `frontAngle` from the building JSON in the engine, publish the camera labels for the pads, and reset them on a model change; verify the labels and tooltips in the running viewer.

## 3. Navigation and controls

- [x] 3.1 Add the pinned `@blueprintjs/core` and `@blueprintjs/icons` dependencies and import their CSS once in `main.tsx`; verify `npm run viewer:build` and `npm run typecheck`.
- [x] 3.2 Rebuild `Toolbar.tsx` into Model, Camera and Tools sections with labels left and controls right: Blueprint switches with `Off`/`On` tracks, disabled controls kept visible, the revision picker below the model picker, and Revision Diff shown but disabled without a revision; verify the diff, identify and revisions browser suites.
- [x] 3.3 Replace the storey selector with the vertical Levels slider: one clickable notch per storey with `data-storey`, the highest at the top, an eye on the handle, names right-aligned against the track, and the track in the right-hand control column; verify notch selection, drag, Up/Down stepping and the single-storey disabled state in the storey browser suites.
- [x] 3.4 Put the flat elevation cross (Back/Left/Top/Right/Front) above the N/W/E/S true-north cross, using compact solid camera snaps; verify the pads' geometry, labels and view changes in Chromium.
- [x] 3.5 Narrow the storey shortcut's focus guard to text fields, selects and textareas so a focused switch or slider still steps; verify the keyboard and focus browser tests.

## 4. Documentation and specifications

- [x] 4.1 Update `docs/getting-started.md`, `docs/rendering.md`, `docs/modelling.md`, `docs/architecture.md` and `docs/development.md` for the rail, the Levels slider, the camera pads, `site.frontAngle` and the new test names; verify every documented control in the running viewer.
- [x] 4.2 Move the in-place `openspec/specs/` edits into this change's delta specs and restore the main specs, so the delta is authoritative until archive; verify `npx openspec validate --all --strict` passes.
- [x] 4.3 Update the browser tests for Blueprint's label-activation switches and the slider's `data-storey` attribute, including the hot-reload tests added by main; verify the full viewer suites pass.

## 5. Integration verification

- [x] 5.1 Run `npm run format`, `npm run typecheck` and `npm test`; verify all 602 tests pass across 52 files and that generated schema/IFC/plan/SVG outputs are up to date.
- [x] 5.2 Run `npx openspec validate --all --strict`; verify every spec and change passes.
- [x] 5.3 Eye-check the viewer in Chromium: both camera crosses, Front matching `?view=front`, the Levels track aligned with the switch controls, notch selection and handle drag, and no console errors.

## Workflow follow-up

- Review and merge PR #77 with this change.
- Archive the change after merge, syncing its delta into `openspec/specs/`, then run `npx openspec validate --all --strict` again.
