# Tasks

## 1. Movement helpers

- [x] 1.1 Add `viewer/walk.ts` with the 1.6 m eye height, 3 m/s walking speed, `KeyW`/`KeyA`/`KeyS`/`KeyD` and arrow-key mapping, heading basis, normalised movement offset, entry position and the snapshot guard, with the helpers working in scene metres (the caller converts the building JSON's millimetre elevations); verify `npm run typecheck` passes.
- [x] 1.2 Add `tests/viewer-walk.test.ts` covering forward, back and strafe directions, diagonal normalisation, unchanged Y, the JSON/IFC floor fallback and snapshot suppression; verify `npx vitest run tests/viewer-walk.test.ts` passes.

## 2. Viewer integration

- [x] 2.1 Add the Walk button and `#walk-hint` prompt to `viewer/index.html`, hide the prompt in snapshots with a `body.snapshot #walk-hint` display rule and style the active button; verify `npm run typecheck` passes and the controls appear when running `npm run view`.
- [x] 2.2 Add the walk lifecycle to `viewer/main.ts`: save and restore the projection, camera-controls pose and orthographic framing, switch to perspective, disable the camera component and camera-controls input while walking, create `PointerLockControls` lazily and request pointer lock from the button and canvas; verify `npm run typecheck` passes and that entering and leaving restores both an SW and a Top view, with the Top view's framing unchanged.
- [x] 2.3 Add the walk frame loop in `viewer/main.ts`: keydown/keyup tracking with a `blur`/`visibilitychange` clear, heading-relative WASD and arrow movement, fixed eye height, clamped frame delta, and fragment and compass refreshes; verify `npm run typecheck` passes and that walking into a wall passes through it without changing height.
- [x] 2.4 Add every exit path: Escape, pointer-lock release, view buttons and model changes; ignore an unlock that follows a refused lock, and keep the prompt and keyboard movement active on `pointerlockerror`; verify `npm run typecheck` passes and manual entry/exit round trips leave the previous camera pose intact.
- [ ] 2.5 Document the Walk controls, click-to-look prompt, fixed eye height, absent collision/vertical movement and snapshot behaviour in `docs/rendering.md`; verify the documented steps by following them in `npm run view`.

## 3. Integration verification

- [ ] 3.1 Check the golden path in `npm run view`: Walk button entry with pointer lock, mouse look, WASD and arrows, `?walk=1` click-to-look, Escape restoring the previous view, view/model changes ending walk mode, and labels, compass and plan style still working, noting whether labels make rooms unreadable up close.
- [x] 3.2 Run `npm run typecheck` and `npm test`, including the plan-versus-3D test; confirm `?snapshot=1&walk=1` leaves snapshot output unchanged and `git status` shows no generated schema, IFC or `out/` changes.

## Workflow follow-up

- Review the implementation against the delta spec and get feedback before merging.
- Archive the change after review and merge.