# Proposal

## Why

The viewer can show a model's rooms, dimensions and checked constraints, but it cannot answer an
ad-hoc question such as "how far is this corner from that one?". Answering it today means adding a
constraint to the model and rebuilding, which is the wrong tool for a one-off check. A click-to-
measure tool lets the user read distances straight off the existing geometry without changing the
model.

## What Changes

- The viewer SHALL gain a **Measure** toggle and `?measure=1` that put it in measure mode. Measure
  mode SHALL start off, SHALL be ignored in snapshots, and SHALL be mutually exclusive with walk
  mode. The URL parameter SHALL apply only at startup, so changing models does not turn a mode the
  user has switched off back on.
- In measure mode, a click or tap on the model SHALL pick a point, snapping to the nearest corner
  or edge and falling back to the exact point on the face when no snap is close. A click that
  arrives while a pick is being resolved SHALL be kept as the next candidate, not silently lost.
  A second pick SHALL create a numbered measurement and keep it in a list; further pairs add more.
- Each measurement SHALL be drawn at its measured position as a depth-tested solid line, with a
  marker at each point and a camera-facing label at the midpoint, so a wall or floor in front hides
  it like geometry rather than letting it float through the building. The label and a visible
  measurement list SHALL give the straight-line distance, the horizontal (plan) distance and the
  vertical difference in millimetres.
- A **Clear** control SHALL remove every measurement and any pending first point. Escape SHALL
  cancel a pending point, or leave measure mode when none is pending. Changing the model or
  entering walk mode SHALL clear measurements; changing the camera view SHALL not. Completed
  measurements SHALL stay visible when measure mode is off.
- Measurements SHALL be in-memory viewer state only: they SHALL NOT change the building JSON, the
  JSON Schema, the IFC, the generated constraints file or 3D snapshots.
- Out of scope: editing the model, adding or changing constraints, saving measurements across
  reloads or in the URL, deleting or hiding a single measurement, area/angle measurement,
  axis-locked dimensioning, and automatic label collision avoidance.

## Capabilities

### New Capabilities

<!-- None: this extends the existing viewer capability. -->

### Modified Capabilities

- `ifc-viewer`: the viewer gains an interactive measurement mode, with picking, snapping, a
  visible measurement list and measurement labels.

## Impact

- `viewer/main.ts` wires the measure mode to picking, drawing and model loading; `viewer/measure.ts`
  holds the measurement maths, formatting, snap-choice and gesture helpers; `viewer/index.html`
  adds the **Measure** and **Clear** controls, the measurement list panel and a measure hint.
- `src/render/style.ts` gains a measurement colour, distinct from the constraint red.
- `tests/viewer.test.ts` covers the pure measurement helpers; `tests/viewer-measure.test.ts` covers
  the browser interaction and is excluded from `npm run test:fast`; `docs/development.md` lists it.
- `viewer/main.ts`'s query-parameter header and the viewer sections of `docs/getting-started.md`
  and `docs/rendering.md` describe the new controls and `?measure=1`.
- No new dependencies, no change to the building schema, JSON Schema, IFC bytes or generated
  files, and no change to `build` or `render`.