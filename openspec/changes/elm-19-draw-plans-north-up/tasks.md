# Tasks

## 1. Plan renderer

- [ ] 1.1 Give `makeView` an `orientation: "north" | "project"` option. Turn points by −`northAngle` in `toPx` and invert it in `toMm`, and take the sheet extent from the turned points. Keep `overlay()` on `"project"`. Verify the example cottage's SVG snapshot is unchanged.
- [ ] 1.2 Add an `orientation` option to `renderPlan`, defaulting to `"north"`. Draw the north arrow at `northAngle` minus the sheet's turn. Verify a 135° model's arrow is drawn with `rotate(0)` and a project-oriented one with `rotate(-135)`.
- [ ] 1.3 Map all four corners of the room label box to mm in `roomDimensions`. Verify unturned room dimensions are unchanged, and a turned room's dimension lines stay clear of its label.
- [ ] 1.4 Add turned-plan tests to `tests/render.test.ts`: a wall's px footprint matches its turned mm footprint, every wall stays inside the sheet's margins, and room text stays horizontal. Verify `npx vitest run tests/render.test.ts` passes.

## 2. Viewer

- [ ] 2.1 Turn the corner directions in `cameraForView` (`viewer/view.ts`) by the north angle, and give Top an up vector along true north. Read `?orient=project` to use 0. Verify unit tests for `ne` at 135° (camera at plan −x), at 0° (unchanged) and for `orient=project`.
- [ ] 2.2 Wire the angle into `setView` in `viewer/main.ts` once the model JSON is loaded, and re-apply the current view when it arrives. Verify the compass points straight up in the Top view of elmstead, and flat labels read left to right.

## 3. Comparison and snapshots

- [ ] 3.1 Render plans with `orientation: "project"` and open the viewer with `orient=project` in `tests/plan-vs-3d.test.ts`. Verify it passes on the same storeys as before.
- [ ] 3.2 Check that `render`'s snapshots pick up the true-direction cameras without code changes in `src/render/snapshot3d.ts`. Verify elmstead's `3d-ne.png` shows the front, which faces north-east.

## 4. Documentation

- [ ] 4.1 Update `docs/rendering.md` and `docs/getting-started.md`: plans and the Top view are true north up, corner views use true directions, and `?orient=project`. Update the `northAngle` entry in `docs/modelling.md` to say it turns the drawings. Verify the wording matches the specs.

## 5. Verification

- [ ] 5.1 Run `npx openspec validate --all`, `npm run typecheck` and `npm test`, and regenerate `out/` with `npm run all models/elmstead/index.ts`. Verify all pass, and check elmstead's plan PNGs and 3D snapshots by eye.
