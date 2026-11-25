# Tasks

## 0. Measurement and baseline

- [x] 0.1 Add `scripts/bench-viewer.ts`, which loads a model in the viewer under Playwright Chromium (SwiftShader by default, `--gpu` for the real GPU) and prints JSON: load time, texture upload count, largest and total uploaded texels, and median and p90 frame interval and GPU time while orbiting. Verify that it runs on `elmstead` and prints numbers matching the earlier profiling (about 1.3 GB of textures, and a largest texture of 5612×5092).
- [x] 0.2 Add `scripts/compare-viewer.ts`, which captures plan-style screenshots at fixed views (top, two corners, and close-ups of a window, a door swing and a dimension figure, each storey alone and all together) from two viewer roots. It writes side-by-side images, a diff heatmap per view and an HTML index to an output folder, with each view's mismatch ratio. Verify that comparing the tree with itself gives zero difference on every view.
- [x] 0.3 Capture the baseline from `origin/main` in a temporary worktree: run the benchmark on `elmstead` and keep its screenshots. Verify that the baseline JSON and images exist in the scratch folder.

## 1. Drawing primitives in `src/render/`

- [x] 1.1 In `src/render/svg.ts`, make `polygon`, `polyline`, `line`, `text`, `group` and `el` return typed `Node`s, and add `serialise(node)`, which writes exactly the string each helper wrote before. Verify with unit tests in `tests/render.test.ts` comparing `serialise` output with the old strings for each helper, including `num()` rounding and escaping.
- [x] 1.2 Switch `src/render/plan.ts` from `string[]` to `Node[]`, serialising in `renderPlan` and `overlay()`. Verify that `tests/__snapshots__/example-cottage.storey-ground.plan.svg` passes unchanged and that `npm run test:fast` passes.
- [x] 1.3 Make `renderFloor`, `renderWallTops` and `renderPlanAnnotations` return `{ svg, bounds, nodes }`, with `svg` serialised from `nodes`. Verify with a test that `serialise` of the wrapped nodes equals `svg` for every storey of the example models.
- [x] 1.4 Give `dimension()` an optional style (line stroke and width, text halo). Have `renderPlanAnnotations` pass ink at 1 px with a 3 px paper halo and drop its `<style>` node. Verify with a test that annotation lines carry `stroke` = ink and `stroke-width` 1 and figures carry the halo, and that the plan snapshot is unchanged.

## 2. Viewer geometry for primitives

- [x] 2.1 Move `labelTexture` from `viewer/main.ts` into a shared viewer module and return the baseline-to-centre offset as well. Verify that `npm run typecheck` passes and that room labels look unchanged in the viewer.
- [x] 2.2 Add `viewer/overlay.ts` with `overlayGroup(nodes, bounds, y, layer)`, following design §4:
  - batch consecutive primitives with the same material into runs, in painter order;
  - fills as merged unlit meshes;
  - strokes and dashes as world-unit `LineSegments2`;
  - figures as flat text planes;
  - floor or overlay depth treatment.

  Verify with unit tests in `tests/viewer.test.ts`: the px-to-scene mapping, run batching that
  keeps painter order, the stroke-width and dash scale, and the text yaw sign.
- [x] 2.3 Replace `planPlane` in `viewer/main.ts` with `overlayGroup` for the annotation, wall-top and floor layers, keeping their heights and render orders. Have `loadLabels`' generic dispose free their line geometries too. Verify that the plan-versus-3D, storey selection, railing, stair and ground tests in `tests/plan-vs-3d.test.ts` pass.
- [x] 2.4 Add a browser test that wraps `texImage2D`/`texStorage2D`, loads `elmstead` in plan style with labels on, and asserts that no upload exceeds 1,048,576 texels. Verify it fails on the parent commit's viewer and passes now.
- [x] 2.5 Run `scripts/compare-viewer.ts` with the baseline and the change, and review every view's side-by-side and heatmap: windows, door swings, dashed outlines and dimension figures, both close up and zoomed out. If thin lines shimmer or vanish, apply the minimum-width fallback from design.md. Verify that the remaining differences are antialiasing only, and record each view's mismatch ratio.

## 3. Docs and integration

- [ ] 3.1 Update the viewer and rendering notes in `docs/rendering.md` (and `docs/architecture.md` if it describes the overlay textures) so they say the overlays are drawn as geometry from shared primitives. Verify that the docs mention no rasterised overlay planes.
- [ ] 3.2 Run `scripts/bench-viewer.ts` on SwiftShader and Metal and record the before and after JSON in the PR description. Verify that load and frame time improve and that the texture total is under 50 MB.
- [ ] 3.3 Run `npm test`, `npm run typecheck` and `npx openspec validate --all --strict`. Verify that all pass.

## Workflow follow-up

- Mark PR #50 ready for review once the tasks are done.
- Check whether the wall-top poché is redundant with the wall-top shader, as a separate change.
- Archive the change after review, and verify the archived result.
