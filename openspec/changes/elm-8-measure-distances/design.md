# Design

## Context

See `proposal.md` for motivation and the `ifc-viewer` delta for the behaviour.

- `viewer/main.ts` owns the model, camera, input and annotation groups. It already builds
  camera-facing sprites with a paper halo (`billboard`) and flat `Line2` spans (`constraintLine`).
  Measurements reuse those shapes but follow the depth-tested storey-boundary rule rather than the
  older depth-independent overlay materials.
- The loaded `FragmentsModel` is currently local to `load()`. Fragments can raycast its worker-held
  geometry: `raycast({ camera, mouse, dom })` returns a face hit, and
  `raycastWithSnapping({ ..., snappingClasses })` returns snap candidates. The `mouse` field is in
  client/CSS pixels; Fragments subtracts the canvas rect and converts to NDC internally
  (`screenToCast` in the 3.6.1 bundle).
- Camera input is map-style: left drag pans, wheel or pinch zooms, middle/right or three fingers
  orbit. A measure click must coexist with that, so a press that turns into a drag cannot measure.
- Walk mode owns pointer lock and left click. Labels and constraints are independent overlay
  groups with their own buttons and URL parameters. Measurements are the first user-created
  overlay and must not be tied to either group.
- Measurements are inspection annotations, not building data. Nothing in the pipeline may read or
  write them, and a page reload starts empty.

## Goals / Non-Goals

**Goals:**
- Pick snapped corners and edges, with a free-surface fallback, in both perspective and the
  orthographic Top view.
- Minimise diagonals by projecting the second point onto the nearest axis through the first.
- Keep measurement maths, formatting, snap-choice and gesture classification unit-testable
  without a browser.
- Keep every valid click, including one made while an earlier pick is resolving.
- Draw every measurement at its measured position, legible when in front of the model, with its
  three distances visible in the scene and in a small measurement list.
- Keep measure state and rendering lifecycle explicit so Clear, model changes and walk mode cannot
  leave markers pointing at stale geometry.

**Non-Goals:**
- Persistence, per-measurement deletion or hiding, label collision avoidance or leader lines.
- Free diagonal measurements: the second point is always projected onto an axis.
- Snapping to dimensions, levels, whole axes or IFC element properties.
- Changing the schema, constraints, IFC, generated files, `build` or `render`.

## Decisions

### Pick with Fragments' own raycast

The viewer keeps a reference to the active `FragmentsModel`. On a measure click it passes
`new THREE.Vector2(e.clientX, e.clientY)` as `RaycastData.mouse` together with the renderer canvas
and `world.camera.three`. It SHALL NOT convert the pointer to NDC first: Fragments' `screenToCast`
does that conversion and expects client pixels.

The pick path asks `raycastWithSnapping` for `SnappingClass.POINT` and `SnappingClass.LINE`
candidates. Fragments returns these unordered, so the viewer projects each candidate's point to CSS
pixels and chooses the one nearest the click, preferring a `POINT` only when distances tie. A
candidate further than `SNAP_MAX_PX` (initially 12 CSS px) is ignored; the viewer then falls back to
the model's plain `raycast` for the exact face point. If the snap call returns `null` or an empty
list, the same fallback applies. `SNAP_MAX_PX` is deliberately a viewer-side guard: it stops a
distant corner from winning simply because it is a corner, and it is easy to tune after the visual
check.

Clicks are not discarded while a pick is running. The viewer keeps one future candidate (the
latest click wins); when the current raycast resolves, it processes that candidate. Extra clicks
beyond that replace the candidate rather than queueing an unbounded list.

Why this over `THREE.Raycaster` against `model.object`: Fragments geometry is managed and instanced
in worker-owned data, and its raycast API already accounts for model transforms, orthographic
cameras and its own snapping candidates. A three.js raycast would duplicate that and miss the
snapping behaviour.

### Model and pick epochs

The current model reference is set only after a load finishes, and cleared before the old fragments
are disposed. `load()` increments a load epoch before its first `await`; each awaited step checks
that it is still the current load before it installs a model or touches the scene. A model change
also clears measurements and pending state before the first await.

Picks carry the measurement epoch they started in. Clear, Escape, turning measure mode off, walk
entry and model changes increment that epoch, so a raycast that resolves late is dropped instead of
adding a point to a model or mode the user has left. This also covers rapid model-picker changes,
where an earlier `load()` may still be resolving.

### Separate a click from a camera drag

Measure input listens to `pointerdown`/`pointerup` on the renderer canvas, not to `click`: the
browser fires `click` after a pan too. A candidate records its pointer id, start position and
whether a second pointer touched down. It becomes a pick only when the same primary pointer is
released within 4 CSS pixels of its start and no multi-touch gesture occurred. `pointercancel`,
focus loss and a second pointer all discard the candidate. This works for a mouse, a pen and a
one-finger tap without disabling camera-controls, which keeps its own listeners.

### Pure helpers in `viewer/measure.ts`

Following `viewer/walk.ts` and `viewer/constraints.ts`, the browser-independent parts live in a new
module:

```ts
export interface Point3 { x: number; y: number; z: number }
export interface MeasurementValues {
  straightMm: number;   // 3D distance
  horizontalMm: number; // plan distance, sqrt(dx² + dz²) in scene axes
  verticalMm: number;   // |dy|
}
export function measurementValues(from: Point3, to: Point3): MeasurementValues;
export function axisAlignedPoint(from: Point3, to: Point3): Point3;
export function measurementLines(id: number, values: MeasurementValues): string[];
export function measurementSummary(id: number, values: MeasurementValues): string;
export function nearestSnap(candidates: SnapCandidate[], pointer: { x: number; y: number }, maxPx: number): SnapCandidate | undefined;
export function isMeasureGesture(start: { x: number; y: number }, end: { x: number; y: number }): boolean;
```

Scene coordinates are metres with Y up and plan north along −Z; distances are invariant to the
sign convention. Values are converted to millimetres and rounded only for display, in
`measurementLines` and `measurementSummary`, so the three numbers remain independently useful
rather than deriving one rounded value from another.

`SnapCandidate` carries the candidate's CSS-pixel position, its point/edge kind and its world
point; `nearestSnap` returns the chosen candidate.

`measurementLines` returns three strings for the scene label: `M<n> <straight> mm`,
`horizontal <plan> mm` and `vertical <rise> mm`. `measurementSummary` returns one row for the
list: `M<n> <straight> mm · plan <plan> mm · rise <rise> mm`. The leading `M<n>` associates a
line, label and list row when several measurements are on screen. Four pixels is the click slop; a
tap must not be so strict that normal hand tremor turns it into a pan.

### Axis-aligned second points

The raw second pick still goes through snapping and the face fallback. Before the measurement is
created, `axisAlignedPoint` projects it onto the nearest axis line through the pending first point:
scene X, Y or Z, whichever delta is largest. That leaves exactly one non-zero component, so the
span reads like a dimension instead of a diagonal, and the horizontal and vertical figures are
directly meaningful. Ties prefer X, then Z, then Y.

The projected second endpoint can leave the model surface; the second marker shows where the
dimension ends, while the first point stays on the picked geometry. Restricting snap candidates to
axis lines was rejected because a wall may have no vertex on that line; projecting the snapped
pick always produces an axis-aligned point. Leaving the line diagonal was rejected because the
requested behaviour is to minimise diagonals.

### One depth-tested measurements group

`viewer/main.ts` keeps a `THREE.Group` for measurements, always added to the scene. Each completed
measurement contributes:

- a solid `Line2` in a new `C.measure` colour, 3 cm in world units, `depthTest: true`,
  `depthWrite: false`, `renderOrder: 8`;
- a small sphere marker at each endpoint in the same colour, drawn with the same depth settings at
  `renderOrder: 9`;
- a camera-facing sprite at the segment's 3D midpoint, built with the existing `billboard()` helper
  so it gets the paper halo, at `renderOrder: 10`.

The render orders keep the line below its markers and label and order them with the other
annotations, but depth testing decides what is visible. Measurements follow the storey-boundary
rule: they read over the model only where they are in front of it, and a wall, floor or storey
above in front of them hides them. They are never `depthTest: false`, so they cannot float through
the building. Room labels and constraints stay independent, so toggling **Labels** or
**Constraints** never hides a measurement. The pending first point uses the same endpoint marker,
so it reads as a picked point rather than a completed line.

`src/render/style.ts` gains `measure: "#00897b"` (teal), deliberately distinct from the constraint
red and the glass blue. The line material, marker geometry and marker material are shared. Clearing
disposes per-measurement line geometries and label textures/materials, as `loadLabels` already does
for the label group.

There is no separate visibility toggle for completed measurements. The **Measure** button is the
tool's control, measurements exist only because the user created them, and they stay visible while
the mode is off so the model can be orbited without adding points. **Clear** is the way to remove
them; hiding without removing is deliberately out of scope.

### State and lifecycle

The viewer keeps a small state object: `measuring`, the pending `THREE.Vector3 | null`, the
completed list `{ id, from, to }[]`, the next number, and the pick epoch. The transitions follow
the delta spec:

- A first pick becomes pending; a second is projected onto the nearest axis through it, creates a
  measurement, increments the number, updates the scene and the measurement list, and clears
  pending.
- Turning measure mode off cancels pending but leaves the completed list, its labels and the list
  panel.
- **Clear** removes pending and all completed measurements, resets numbering to 1, empties the list
  panel and keeps the current mode. The control is disabled only when there is neither a pending
  point nor a completed measurement.
- Escape cancels pending; with no pending point it turns measure mode off.
- Entering walk mode clears measurements, leaves measure mode and cancels pending. Pressing
  **Measure** leaves walk mode first.
- `load()` clears measurements and pending before its first await. Starting a load invalidates
  in-flight picks through the epoch.
- Camera view changes do not touch measurement state: the points are world-space.

`?measure=1` is applied once after the initial load, like `walkRequested`; it is deliberately not
read inside every `load()`. Otherwise changing models would turn the mode back on after the user
had switched it off. If both `walk=1` and `measure=1` are present, walk wins.

Snapshots skip the mode entirely and hide the measure hint and list, matching the existing snapshot
rule for labels and constraints.

### UI: mode, hint and visible list

`viewer/index.html` adds a **Measure** toggle (`aria-pressed`), a **Clear** button disabled while
there is nothing to clear, and a bottom-centre measure hint styled like the walk hint:
"Click two points on the model · Esc cancels · Clear removes all". A `body.measuring` class gives
the canvas a crosshair cursor.

A compact measurement list sits at the bottom left. It has one row per measurement, uses
`measurementSummary`, and is hidden when empty or in snapshots. It updates from the same state
transitions as the scene labels and does not intercept canvas input. The hint and the list occupy
different corners, so they can coexist.

### A read-only measurement snapshot for the headless test

Like `window.__elmsteadReady` and `window.__elmsteadError`, the viewer exposes
`window.__elmsteadMeasurements` as an array of `{ id, from, to, values }`. It is initialised to
`[]` before the first model load and replaced whenever the list changes, so a test can distinguish
"no measurements yet" from "the page did not load". This lets a Playwright test assert that two
clicks created one measurement, that a drag created none, that Clear emptied the list, and that a
model change cleared the list, without reading WebGL pixels. It is a debugging seam only: nothing
in the pipeline reads it, and snapshots never populate it.

The committed browser test publishes two copies of `models/example-cottage` into a temporary output
directory, serves the viewer as `tests/plan-vs-3d.test.ts` does, and uses the same known geometry
for the normal and snapshot cases. It asserts that a measurement has exactly one non-zero delta,
that its straight-line distance matches that delta, and that the same clicks under
`?snapshot=1&measure=1` leave the list empty, and that turning measure mode off and switching to
the second copy leaves the mode off and the list empty. The exact snapped geometry and the
rapid-second-click queue are still checked by eye in the running viewer, because a headless
assertion cannot tell whether a corner looked right or reliably lose a race with the worker
raycast.

## Risks / Trade-offs

- [Snapping tolerance depends on Fragments and the model scale; a snap may be farther than
  expected] → the viewer chooses the nearest candidate in screen space, gates it with
  `SNAP_MAX_PX`, and falls back to the face point. The visual check confirms the snap feels right
  on the cottage and Elmstead models.
- [A click near a wall may hit the wall top rather than the floor] → the marker shows the actual
  picked point, and the label reports the actual measured geometry; there is no attempt to infer
  the user's intended surface.
- [The projected second endpoint can leave the model surface] → intended for an axis-aligned
  dimension; the second marker shows where it lands, and the first point stays on the geometry.
- [Four-pixel slop is subjective on touch screens] → the same threshold is used for every pointer
  type; it can be tuned in the helper without changing the interaction contract.
- [Depth-tested labels can be hidden by geometry or a floor above] → intended: measurements obey
  the storey-boundary rule rather than floating through the building. In front they read with the
  halo, and the DOM measurement list still gives their values.
- [Several measurement labels and list rows can compete for space in a busy view] → labels are
  numbered, list rows are compact, and the list scrolls. Collision layout and leader lines are
  deferred.
- [Keeping late picks or late loads can add state after the user clears or switches model] →
  measurement and load epochs invalidate them; stale results are dropped rather than applied.
- [Measurements are lost on reload or model change] → accepted: they are inspection annotations,
  not model data, and stale coordinates across a model change would be worse than losing them.
- [There is no hide-without-clear control] → accepted for now: the Measure toggle keeps clicks
  from adding points, completed measurements stay visible, and Clear removes them; a visibility
  toggle can be added later without changing the published data.

## Migration Plan

Not applicable: the change adds in-memory viewer state and UI only. No generated file, schema, IFC
or persisted data changes, so there is nothing to migrate or roll back beyond reverting the viewer
commit.