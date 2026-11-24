# Tasks

## 1. Pure identification helper

- [ ] 1.1 If `node_modules` is absent run `npm ci`, then run `npm run typecheck` and verify it reaches the project rather than failing on missing types.
- [ ] 1.2 Create `viewer/identify.ts` with `elementLabel(data)`: id is `Tag ?? Name`, name is `LongName ?? Name` kept only when distinct from the id, and null when the item names no model element. Unit-test it in `tests/viewer.test.ts`: a wall with Tag and a distinct Name, a wall whose Name falls back to its id (id only), a space with empty Tag, Name = room id and LongName = room name, and an item with neither attribute (null). Verify `npm run test:fast` passes.

## 2. Hover picking and tooltip

- [ ] 2.1 Add the **Ids** button and a `pointer-events: none` tooltip div to `viewer/index.html` with the bar's `aria-pressed` bold-when-active pattern and snapshot hiding; wire the toggle state and `?ids=0|1` in `viewer/main.ts`, off by default and ignored in snapshots. Verify `npm run typecheck` passes and the button toggles its active state in the running viewer.
- [ ] 2.2 Fill a `localId → { id, name }` map from `elementLabel` in the existing `getItems()` pass of `applyStoreyVisibility`; add the hover path in `viewer/main.ts`: plain `model.raycast` on pointermove with one pick in flight and a latest-position queue, no picks while a pointer button is down, tooltip text set with `textContent` and updated only when the id changes, position beside the cursor clamped to the viewport, hidden when the ray hits nothing; publish `window.__elmsteadHover` (`{ id, name } | null`). Verify `npm run typecheck` passes and, in the running viewer with Ids on, hovering a wall shows its id, moving to another element updates it, and moving off the model hides it.
- [ ] 2.3 Compose with the other modes: `enterWalk` hides the tooltip and `exitWalk` restores it while the toggle stays on; `load()` hides it and rebuilds the map on a model change; measure mode keeps working with Ids on (the tooltip blocks no clicks); the storey selector never names a hidden storey's elements. Verify each in the running viewer: measure two points with Ids on, walk and confirm no tooltip, change models and confirm the tooltip hides, and hide the top storey of `models/example-two-storey` and hover where its walls would be.

## 3. Browser tests and documentation

- [ ] 3.1 Add `tests/viewer-identify.test.ts` following `tests/viewer-measure.test.ts`: publish `models/example-cottage` (and `models/example-two-storey` for the storey scenario) to a temporary output directory and cover the delta scenarios — button on/off, `?ids=1`, default off, hovering known geometry reports the right id and name through `window.__elmsteadHover` and the tooltip DOM, off-model hides, moving between elements updates, a drag still navigates, measure mode still measures with Ids on, a hidden storey is never named, walk mode shows no tooltip, a model change hides it, and `?snapshot=1&ids=1` shows no tooltip or Ids control. Add the file to the `test:fast` excludes. Verify the new test passes under `npm test` and `npm run test:fast` does not launch a browser.
- [ ] 3.2 Update the query-parameter header comment in `viewer/main.ts`, the viewer sections of `docs/getting-started.md` and `docs/rendering.md`, and the test table in `docs/development.md` with the Ids control, `?ids=0|1` and the hover tooltip. Verify the documented URLs and button behaviour match what the viewer does.

## 4. Integration verification

- [ ] 4.1 Run `npm run all -- models/example-cottage`, `npm run all -- models/example-two-storey` and `npm run all models/elmstead`; verify the builds and renders pass and no generated file changed unexpectedly — the 3D snapshots must be byte-identical, since snapshots ignore Ids.
- [ ] 4.2 Run the viewer headlessly, take screenshots with Ids on in the Top and a corner view, inspect them for a legible tooltip beside the cursor, and check the page console for errors. Then start `npm run view`, find the actual port, and give the user direct `?model=…&ids=1` URLs for the eye check, including a named element and the two-storey model.
- [ ] 4.3 Finish with `npm test`, `npm run typecheck` and `npx openspec validate --all`, and verify all pass with no generated file left modified.

## Workflow follow-up

- When asked, push the plan to a branch named `elm-9-hover-element-ids` and open a draft `ELM-9:` pull request; the plan PR becomes the implementation PR (re-check open PRs for the number just before creating the change, per AGENTS.md).
- Archive the change after the project's review requirements are satisfied.