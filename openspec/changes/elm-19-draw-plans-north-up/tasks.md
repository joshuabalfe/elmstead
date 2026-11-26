# Tasks

## 1. Plan renderer

- [x] 1.1 Give `makeView` an `orientation: "north" | "project"` option. Turn points by −`northAngle` in `toPx` and invert it in `toMm`, and take the sheet extent from the turned points. Keep `overlay()` on `"project"`. Verify the example cottage's SVG snapshot is unchanged.
- [x] 1.2 Add an `orientation` option to `renderPlan`, defaulting to `"north"`. Draw the north arrow at `northAngle` minus the sheet's turn. Verify a 135° model's arrow is drawn with `rotate(0)` and a project-oriented one with `rotate(-135)`.
- [x] 1.3 Map all four corners of the room label box to mm in `roomDimensions`. Verify unturned room dimensions are unchanged, and a turned room's dimension lines stay clear of its label.
- [x] 1.4 Add turned-plan tests to `tests/render.test.ts`: a wall's px footprint matches its turned mm footprint, every wall stays inside the sheet's margins, and room text stays horizontal. Verify `npx vitest run tests/render.test.ts` passes.

## 2. Viewer

- [x] 2.1 In `viewer/view.ts`, turn Top's camera offset to true south in `cameraForView`, keep the corner cameras on the plan diagonals, add `cornerLabel(view, northAngle)` (nearest of eight compass points, ties clockwise) and `parseOrient`. Verify unit tests: Top at 153° and 0°, corners unchanged at any angle, labels N/W/S/E for `sw`/`se`/`ne`/`nw` at 153° and SW/SE/NE/NW at 0°, and `?orient=` parsing.
- [x] 2.2 Wire the angle into `setView` in `viewer/main.ts`, and relabel the corner buttons (text and title) when the model JSON loads, using plan labels for `orient=project`. Verify the compass points straight up in elmstead's Top view, flat labels read left to right, and the buttons read N/E/S/W.

## 3. Comparison and snapshots

- [x] 3.1 Render plans with `orientation: "project"` and open the viewer with `orient=project` in `tests/plan-vs-3d.test.ts`. Verify it passes on the same storeys as before.
- [x] 3.2 Check that `render`'s snapshots pick up the turned Top camera without code changes in `src/render/snapshot3d.ts`. Verify elmstead's `3d-top.png` has true north up and its corner snapshots are unchanged.

## 4. Documentation

- [x] 4.1 Update `docs/rendering.md` and `docs/getting-started.md`: plans and the Top view are true north up, corner buttons name the true direction they look from, and `?orient=project`. Update the `northAngle` entry in `docs/modelling.md` to say it turns the drawings. Verify the wording matches the specs.

## 5. Verification

- [x] 5.1 Run `npx openspec validate --all`, `npm run typecheck` and `npm test`, and regenerate `out/` with `npm run all models/elmstead/index.ts`. Verify all pass, and check elmstead's plan PNGs and 3D snapshots by eye.
