# Proposal

## Why

Asking the LLM to edit the model means describing elements in words ("the wall between the hall
and the living room"), which is imprecise when several walls look alike. Every element already has
a stable, unique id (`wall-hall-living`, `door-front`) that the LLM can find in `models/` — but
nothing in the viewer shows which id belongs to which element. Surfacing the id on hover turns a
vague description into a precise reference: "move `wall-hall-living` 200 mm north".

## What Changes

- Add an **Ids** toggle button to the viewer bar, off by default, with `?ids=0|1` to set it at
  load, following the existing Labels/Constraints/Measure controls.
- While Ids is on, hovering the pointer over model geometry shows a small tooltip beside the
  cursor with the element's model id, and its name when it has one distinct from the id.
- The id shown is the element's model id — the IFC `Tag` (the `Name` for rooms, whose `Tag` the
  writer leaves empty). TypeScript variable names are local to each model file and do not survive
  the model → JSON → IFC pipeline; the id is the handle the model code, the checks and the LLM
  all share.
- Hover identification is passive: it works in every interactive view and style, alongside measure
  mode (clicks still measure), and follows the storey selector, since the raycast already skips
  hidden items. It is inactive in walk mode (the pointer is locked) and in snapshots.
- Snapshots ignore the toggle and the parameter, so 3D snapshots stay deterministic.
- Hover state is ephemeral: nothing is written to the building JSON, constraints JSON, IFC or
  snapshots.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ifc-viewer`: new requirements for the Ids toggle and hover identification — what the tooltip
  shows, when it appears, and how it composes with storeys, measure mode, walk mode and snapshots.

## Impact

- `viewer/index.html`: the Ids button, a tooltip element and its styles.
- `viewer/main.ts`: hover picking and tooltip wiring; a small `viewer/identify.ts` helper module
  for the item-to-label mapping, following the `measure.ts` / `walk.ts` pattern.
- `tests/`: a headless viewer test for the toggle, tooltip content and mode composition, following
  `viewer-measure.test.ts`.
- `docs/getting-started.md` and the `viewer/main.ts` header comment: the new control and parameter.
- No schema, IFC writer, pipeline or dependency changes; the ids already reach the viewer as IFC
  `Tag`/`Name`.