# Proposal

## Why

The viewer's controls grew feature by feature into a stack of differently-shaped buttons: persistent
settings such as labels, constraints, ids, transparency and diff hide or change shape when they are
unavailable, the storey picker is a native select, and the camera snaps label plan corners with
compass names instead of offering the views a building actually has. The controls are hard to scan,
and the flat views cannot line up with the front of a building whose front is not plan south.

The rebuild in PR #77 fixes that with a Blueprint navigation rail, one control language for switches
and sliders, and camera views driven by the building's true north and its own front. This change
records the behaviour, design and follow-up work as a numbered OpenSpec change, so it can be
reviewed and archived like the rest of the viewer.

## What Changes

- **Group the navigation.** The left rail becomes three labelled sections — Model, Camera and Tools
  — with control labels on the left and their controls on the right. Persistent settings become
  Blueprint switches whose tracks read the current state (Off/On); unavailable controls stay
  visible and disabled. Measure and Clear remain action buttons.
- **Replace the storey selector with a Levels slider.** The slider is vertical, with one notch per
  storey and the highest at the top. Level names are right-aligned beside the track and an eye on
  the handle shows what the slider affects. Choosing a notch or dragging the handle shows that
  storey and every storey below; Up and Down still step it. A single-storey model shows the slider
  disabled. The `?storeys=` contract is unchanged.
- **Add camera pads.** A cross of flat Front, Back, Left and Right elevations, with Top in the
  centre, sits above a cross of true-north N, W, E and S isometric snaps. The Top view stays true
  north up. The older plan-corner `?view=sw|se|ne|nw` values keep their meaning for links and
  snapshots.
- **Add `site.frontAngle`.** The optional schema field gives the front's outward direction,
  counter-clockwise from plan +y and defaulting to 180° (plan south). It drives the flat
  elevations only and is independent of `site.northAngle`.
- **Unify control names and states.** The switches are **Show Labels**, **Show Constraints**,
  **Show IDs on Hover**, **Revision Diff** and **Transparency**. The revision picker sits below the
  model picker and is shown but disabled for a model with no revisions; **Revision Diff** is shown
  but disabled without a revision.
- **Narrow the storey shortcut's focus guard.** Arrow stepping still works while the Levels slider
  or a checkbox has focus, but is ignored while a text field, select or textarea has focus.
- Update the viewer and model-authoring specs, the docs, and the browser tests for the new
  controls and view ids; regenerate the JSON Schema.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ifc-viewer`: the navigation controls, Levels slider, switch names and states, true-north camera
  snaps, flat elevations, camera-view URL values, and the storey shortcut's focus scope.
- `model-authoring`: `site.frontAngle` and its default.

## Impact

- `src/frontend/components/Toolbar.tsx`, `styles.css`, `state/store.ts`,
  `hooks/useViewerShortcuts.ts`, `lib/view.ts`, `scene/engine.ts` and `main.tsx`.
- `src/shared/render/views.ts` and `src/shared/schema/schema.ts`, plus the regenerated
  `schema/building.schema.json`.
- `models/elmstead/index.ts` (front 90°) and `models/examples/example-cottage/index.ts` (front 180°).
- `docs/getting-started.md`, `docs/rendering.md`, `docs/modelling.md`, `docs/architecture.md` and
  `docs/development.md`.
- The viewer browser tests and `tests/viewer.test.ts`, `tests/elmstead.test.ts` and the viewer test
  support.
- New pinned dev dependencies: `@blueprintjs/core` and `@blueprintjs/icons`.
- No IFC, plan, existing 3D snapshot or generated model output changes are intended; the new
  optional schema field leaves existing models valid.
