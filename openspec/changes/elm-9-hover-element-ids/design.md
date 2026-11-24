# Design

## Context

See proposal.md for motivation. The viewer already raycasts fragments for the measure tool
(`pickAt` in `viewer/main.ts`), and `applyStoreyVisibility` already iterates `model.getItems()`
and reads each item's `Tag`/`Name`. Every element's model id reaches the IFC as its `Tag` (rooms
are the exception: `Tag` empty, `Name` = room id, `LongName` = room name — see docs/ifc.md).
Fragments' raycast runs in its worker and already filters out items hidden by `setVisible`
(`filterVisible` in the package's raycast controller), so the storey selector composes without
extra work.

## Goals / Non-Goals

**Goals:**
- Identify the element under the cursor by its model id, cheaply enough to track the pointer.
- Reuse the existing pick, item-data and UI patterns so the feature reads like the rest of the
  viewer.

**Non-Goals:**
- Click-to-copy the id, highlighting the hovered element, or any selection state.
- TypeScript variable names (they do not survive the pipeline; the id is the shared handle).
- Touch support: hover is a mouse/trackpad concept; taps keep their existing navigation and
  measure behaviour.
- Identifying rooms by their 2D outlines: rooms keep their existing labels. Hover covers whatever
  solid geometry the raycast hits (walls, slabs, doors, windows, stair flights and landings).

## Decisions

### Show the model id, with the name when it differs
The tooltip's first line is the id, the second the name only when it is distinct. One rule covers
every element: `id = Tag ?? Name`, `name = LongName ?? Name`, shown when `name !== id`. For a
wall with no name, `Name` falls back to the id and only the id shows; for a room, `Name` is the
room id and `LongName` the room name. Alternative — mapping ids back to TypeScript variable names
by parsing `models/` — was rejected: variable names are per-file, generated ids (`rectWalls`) and
inline elements have no stable variable, and the id is already what checks, constraints and the
LLM reference.

### Build a localId → label map in the existing getItems pass
`applyStoreyVisibility` already fetches every item once per load. Fill a
`Map<number, { id, name }>` in that same loop via a pure helper in a new `viewer/identify.ts`
(`elementLabel(data)` returning null when the item names no model element), following the
`measure.ts` / `walk.ts` split of pure helpers and DOM wiring. Hover then needs no worker
round-trip for item data — only the raycast itself. Alternative — `getItem(localId)` per pick —
works but repeats a lookup the load already does.

### Plain raycast on pointermove, one pick in flight
Hover needs the nearest face hit, not corner/edge snapping, so use `model.raycast` (not
`raycastWithSnapping`). Picks are async worker calls: keep at most one in flight, remember the
latest pointer position, and re-pick on completion if it moved — the same queue pattern as
`runPicks`. Skip picking while any pointer button is down (`e.buttons !== 0`), so drags navigate
without a flickering tooltip. Alternative — a three.js Raycaster over the meshes — was rejected:
fragments geometry lives in the worker, and `model.raycast` is the supported path that already
respects visibility.

### HTML tooltip in client space
A `pointer-events: none` div beside the cursor (offset a few px, clamped to the viewport), styled
like the walk/measure hints. Text is set with `textContent`, never innerHTML, keeping the
"names are rendered as text" guarantee. Alternative — a 3D billboard sprite — was rejected: a
hover label should track the cursor in screen space, not sit in the scene, and HTML text is
crisper at any zoom. Update the text only when the picked id changes; move the position on every
pointermove.

### Passive overlay, not an exclusive mode
Ids does not join the walk/measure exclusivity: it captures no input, so it coexists with measure
(clicks still pick points) and with navigation. Walk mode locks the pointer, so `enterWalk` hides
the tooltip and `exitWalk` restores it while the toggle state stays on. `load()` hides the tooltip
and rebuilds the map on a model change. Snapshots ignore `?ids=` and never show the tooltip, like
walk and measure. The button uses the same `aria-pressed` + bold-when-active pattern as the other
toggles; the parameter is `?ids=0|1`, default off.

### Test hook
Publish `window.__elmsteadHover: { id, name } | null`, mirroring `__elmsteadMeasurements`, so
headless tests assert the identified element without reading pixels; tests also check the tooltip
DOM's text and visibility. A new `tests/viewer-identify.test.ts` follows `viewer-measure.test.ts`:
publish the cottage into a temp out dir, drive the viewer with Playwright, hover known geometry
and assert the id against the published model.

## Risks / Trade-offs

- [Raycast cost on every pointermove] → one pick in flight, latest-position queue, no picks while
  dragging; the models are house-sized and the measure tool already raycasts interactively.
- [Rooms (FootPrint-only spaces) may not be raycastable] → the spec's scenarios use solid
  elements; rooms keep their labels. Verify during implementation and note it in the docs if
  spaces turn out not to be pickable.
- [Hidden-storey picking depends on fragments' visibility filter] → a dedicated test scenario
  covers it; if the library ever picks hidden items, filter the result against the storey owner
  map the viewer already builds.
- [Tooltip flicker at element boundaries] → text updates only when the id changes; the position
  follows the pointer, so crossing a boundary swaps the text in place.

## Migration Plan

None: viewer-only, no persisted state, no generated-file changes. Rollback is reverting the
viewer edits.

## Open Questions

None. Whether 2D spaces are pickable is an empirical detail that does not change the contract
(the scenarios hover solid elements).