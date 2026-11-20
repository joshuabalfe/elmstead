# Design

## Context

See `proposal.md` - Why. The viewer is a small Vite app on ThatOpen components 3.6.0 and three
0.187.0. `viewer/main.ts` owns an `OBC.OrthoPerspectiveCamera`; camera-controls drives the orbit and
plan views, and the viewer's frame loop calls the camera component's `update`, which calls
`controls.update()` and would overwrite any pose written directly to the camera. The existing
camera views, labels, plan style, compass and 3D snapshots all read that one camera, so walk mode
must reuse it rather than introduce a second renderer.

There is no existing test for camera input; the plan-versus-3D test covers the rendered top view,
and snapshots run with `?snapshot=1`.

## Goals / Non-Goals

**Goals:**
- A first-person walkthrough with pointer-lock look and keyboard movement.
- Exact restoration of the previous orbit or orthographic view on exit.
- No change to snapshot output, labels, plan style or the compass.
- Movement and startup maths that can be unit-tested without a browser.

**Non-Goals:**
- Collision, gravity, step handling, stairs or vertical movement.
- Touch or gamepad controls.
- Changes to the schema, model, IFC or generated artefacts.
- New dependencies.

## Decisions

### Reuse the perspective camera and pause camera-controls

Switch `world.camera.projection` to `Perspective`, then set `world.camera.enabled = false` while
walking. The `World` still updates the renderer with `world.camera.three`; only the camera
component's `update` (and therefore `controls.update()`) is skipped, so the walk pose is not
overwritten. Also set `world.camera.controls.enabled = false`: disabling the component leaves
camera-controls' DOM handlers attached, and wheel or drag gestures during the walk would mutate
its internal dolly and zoom state, which the first `update` after re-enabling would apply.
Re-enable both on exit, after the saved pose is restored.

Alternatives rejected:
- ThatOpen's `FirstPersonMode` only shortens the orbit distance; it adds no WASD and leaves
  camera-controls in charge.
- A separate camera or renderer would need duplicated fragment-culling, label and compass wiring.

### Pointer lock through three's `PointerLockControls`

Use `PointerLockControls` from `three/addons/controls/PointerLockControls.js`. It is part of the
pinned three package and handles pointer-lock events, YXZ mouse look and pitch clamping. Create it
lazily on the first entry, after switching projection, so it holds the perspective camera.
Disable it outside walk mode so its document listeners do nothing.

The Walk button and a click on the canvas request pointer lock; browsers require that user gesture,
so `?walk=1` enters the mode and shows a click-to-look prompt instead of calling
`requestPointerLock()` on load. Listen for `pointerlockerror` to keep walk mode active, leave the
prompt up and report the failure in the status line. Only an unlock after a successful lock exits,
so a refused request does not drop the user back to orbit.

Alternatives rejected:
- A hand-written pointer-lock and mousemove handler duplicates well-tested event handling.
- `FirstPersonMode` does not provide mouse capture.

### Fixed-height movement with pure helpers

`viewer/walk.ts` holds the testable parts:

- code-to-axis mapping for `KeyW`/`KeyA`/`KeyS`/`KeyD` and the arrow keys;
- the horizontal heading basis (`right = forward × up`);
- a normalised diagonal offset at 3 m/s, with the frame delta clamped to 100 ms;
- the 1.6 m eye height and the entry position.

The frame loop derives the heading from the camera's forward direction with Y zeroed (falling back
to plan north when looking straight up or down), applies only X/Z movement, then snaps Y to the
entry eye height. No geometry query is made, so walls and floors are passed through. Storey
elevations in the building JSON are millimetres while the scene is metres; the helpers work in
scene metres and the caller converts. A `blur`/`visibilitychange` listener clears the pressed-key
state, so a focus loss that does not release pointer lock (the `pointerlockerror` path) cannot
leave the camera drifting.

Alternatives rejected:
- `PointerLockControls.moveForward()`/`moveRight()` read the camera matrix, are awkward to test and
  still require custom key state.
- Gravity or ray-cast collision is the deferred scope, not part of this change.

### Camera state save and restore

Before entry, save the projection mode, camera-controls position and camera-controls target and,
because the projection switch recomputes them, the orthographic camera's framing
(`threeOrtho.left/right/top/bottom/zoom`): `ProjectionManager` derives the ortho frustum from the
live perspective pose when switching, forces `controls.distance = 200`, and calls `zoomTo(1)` when
switching to perspective, so position and target alone cannot recover a Top view's framing. Enter
at the footprint centre (`box.getCenter()`) with Y at the lowest storey's elevation plus 1.6 m and
an identity quaternion, which faces plan north (scene −Z). The lowest storey elevation comes from
the building JSON that the label loader already fetches, converted from millimetres to scene
metres; when that JSON is absent, use the IFC box's minimum Y.

On exit, unlock, clear pressed keys, cancel the animation frame, re-enable the camera component,
restore the saved projection, write the saved orthographic framing back when that projection is
Orthographic, `setLookAt(position, target, false)`, re-enable camera-controls input, then refresh
fragments and the compass. Escape is the browser's pointer-lock release, so the unlock handler performs the same
exit. View buttons and the model picker exit walk mode before changing the view; the initial
`?walk=1` is consumed once and does not re-enter after a model change.

### Snapshot isolation

`enterWalk` returns immediately when `snapshot` is true, and a new `body.snapshot #walk-hint`
display rule hides the walk prompt; the existing `body.snapshot` CSS only hides the `#bar`
toolbar, and the hint lives outside it. Snapshots therefore keep their current camera, readiness signal and deterministic
pixels even with `?walk=1`.

### UI and rendering refresh

Add a Walk button beside Labels and a pointer-events-none `#walk-hint` overlay shown while walk
mode lacks pointer lock. Reflect the active state with `aria-pressed`.

Because camera-controls' `update` event stops firing, update the compass and call
`fragments.core.update()` from the pointer-lock change event and whenever the frame loop moves the
camera. Labels keep their existing toggle and depth behaviour, though they can be visually busy close up —
the annotation sprites draw over everything (`depthTest: false`); no automatic hiding is added,
but revisit this (for example, labels off by default in walk mode) if task 3.1's golden-path check
finds labelled rooms unreadable at close quarters.

## Risks / Trade-offs

- [Camera-controls overwrites the walk pose] → disable the camera component while walking and
  re-enable it only after restoring the saved view.
- [Exit loses the orbit or ortho pose] → save projection, position, target and the orthographic
  framing before entry; restore them before re-enabling camera-controls input.
- [Wheel or drag during walk corrupts the restored pose] → disable camera-controls input
  (`controls.enabled = false`) while walking.
- [Pointer lock is unavailable or refused] → keep walk mode, keep the prompt and status message,
  and leave WASD working; snapshots never enter walk mode.
- [Fragments culling or compass lag] → refresh both on look and movement.
- [Entry starts inside a wall or on the lowest storey only] → accepted: there is no collision or
  vertical movement in this change; upper storeys are reached by a later feature.
- [Ceiling labels distract up close] → accepted; the existing Labels toggle remains the control.

## Migration Plan

None. Walk mode is opt-in and stores no state; removing the button and `?walk=1` reverts it.

## Open Questions

None.