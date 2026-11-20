# Proposal

## Why

Reviewing a building from fixed orbit views makes it hard to judge scale and sequence from inside its rooms. A first-person walkthrough gives that experience immediately. Collision and physics are deliberately out of scope, so the viewer can gain the mode without adding a geometry-query system.

## What Changes

- Add a Walk mode to the local viewer, entered from a toolbar button or `?walk=1`.
- Use a perspective camera at a fixed 1.6 m eye height. Mouse look uses pointer lock; W/A/S/D and the arrow keys move relative to the current heading.
- Start on the lowest storey at the model's footprint centre, facing plan north. Movement has no collision, gravity, step or vertical handling, so the camera passes through walls and floors and stays at eye height.
- Show a click-to-look prompt when `?walk=1` enters the mode without a user gesture; request pointer lock on the first click. Entering from the Walk button requests it immediately.
- Exit on Escape, on releasing pointer lock, on choosing another view, or on changing model, restoring the previous orbit or orthographic camera.
- Leave snapshots unchanged: `?snapshot=1` ignores walk mode so plan-versus-3D and close-up snapshots stay deterministic.
- Extract the movement and look maths into testable helpers and add unit tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ifc-viewer`: add a first-person walk mode with pointer-lock look and keyboard movement; keep snapshots, labels, plan style and the compass working.

## Impact

- `viewer/main.ts`: walk-mode lifecycle, input handling and camera restore.
- `viewer/index.html`: Walk button and click-to-look prompt.
- `viewer/walk.ts`: pure heading, movement and eye-height helpers.
- `tests/viewer-walk.test.ts`: unit tests for the helpers.
- `docs/rendering.md`: walk-mode controls and the no-collision limitation.
- No schema, model, IFC, generated-output or dependency changes; three's bundled `PointerLockControls` is used.