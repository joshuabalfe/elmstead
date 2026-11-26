# Design

## Context

See `proposal.md` for the motivation. This change builds on ELM-15, which:
- names revisions `<model>@<revision>`, whether they are a file (`revisions/<r>.ts`) or a folder
  (`revisions/<r>/index.ts`), and builds them through the ordinary pipeline;
- keeps element ids, and therefore IFC GlobalIds and `Tag`s, the same across a model and its
  revisions;
- requires a revision to have exactly its base's storey ids, and has the CLI load the base for a
  revision to check that;
- shares one id walk, `idNodes(model)` in `src/schema/ids.ts` (main's, moved there by ELM-15),
  giving each id's kind, storey, element and, for editable ones, place;
- gives the viewer a revision picker and a keep-view load, keeps every shown revision of the
  current model loaded (`resident` in `viewer/main.ts`), and pauses the renderer for the length of a
  switch, so a switch shows only the old picture and then the finished new one;
- moves the example to `models/examples/example-cottage/`, with a `rear-extension` revision.
  `example-two-storey` becomes the test fixture `tests/fixtures/two-storey/`.

What exists to build on:
- **The JSON is deterministic** (`src/cli/json-format.ts`), so serialising an element and comparing
  the strings is an exact equality test.
- **The viewer maps IFC items to model ids** by `Tag`, or by `Name` for spaces
  (`applyStoreyVisibility` in `viewer/main.ts`). It hides storeys with `setVisible`.
- **The pinned `@thatopen/fragments` 3.6.1 colours items in place.** `FragmentsModel` has
  `highlight(localIds, material)`, `setColor`, `setOpacity` and `resetHighlight`, so Diff mode needs
  no new dependency and no re-meshing.
- **Plan style draws parts of the floor as overlays from the JSON** (`renderFloor` and
  `renderWallTops` in `src/render/`, turned into scene geometry by `planGeometry`). An item's IFC
  colour alone would leave a green wall with a charcoal top in the top view.

## Goals / Non-Goals

**Goals:**
- One pure, tested diff function used by both the CLI and the viewer.
- A Diff view that reads at a glance from any camera, with the existing building as faded context.
- Show what was removed with its real geometry, in place.

**Non-Goals:**
- Diff plan SVGs, sub-element diffs, revision-to-revision diffs (see the proposal's scope).
- Choosing colours per user, or colour-blind palettes beyond picking hues that differ in lightness as
  well as hue.

## Decisions

### The diff is a pure function over two models, in `src/diff/`

```
diffModels(base: BuildingModel, revision: BuildingModel) -> {
  added:   [{ id, kind, storey }],   // in revision order
  removed: [{ id, kind, storey }],   // in base order
  changed: [{ id, kind, storey }],   // in revision order
}
```

Both models go through the shared `idNodes` walk, indexed by id. The diff adds the element's JSON, serialised with the
deterministic formatter, to each entry. Storeys are serialised with their element arrays left out, so
a storey only changes when its own fields do. Since storey ids match by ELM-15's rule, a storey can
only ever be changed, never added or removed.

Two propagation passes follow the direct comparison. An opening that isn't already listed is added to
`changed` when:
1. its `componentId` is a changed or added component;
2. its `wallId` is a changed wall.

The second pass exists because an opening is placed by `offsetAlongWall` from its wall's start.
Replacing a wall with one whose start has moved shifts every opening in it, while the openings' own
JSON stays the same. Lengthening a wall at its end amber-marks its openings too. That is
conservative, but it's never wrong to look again at an opening in a wall that changed.

Ordering follows each model's own order, so the output is deterministic without sorting, and it
reads in the same order as the model files.

`src/diff/` depends only on `schema` and the JSON formatter, so the viewer can import it as it
already imports the plan renderers. The viewer computes the diff from the two building JSONs it
fetches. `diff.json` exists for people, pull requests and tools, not as the viewer's input. That
avoids a third file that could be stale against the IFCs it describes.

Alternatives considered:
- **Diff the IFC files.** GlobalIds would match, but comparing geometry means comparing tessellated
  meshes, and every message would point at IFC entities, not model ids.
- **A field-level diff** (which property of `wall-east` changed). It's useful for a tooltip, but it
  doubles the output for the first version. The element-level result is enough to colour, and the
  JSON files can be diffed by hand for detail.

### The CLI reuses the base ELM-15 already loads

ELM-15's CLI loads the base model (`<folder>`) for every revision, to check its storeys, for both file
and folder revisions. The diff takes that same loaded base. It needs no build and no checks of its
own. `build` writes
`diff.json` with the other outputs in the same atomic step. `check` and `all` print the summary line
too. The diff never reports issues, because a revision adding or removing things is the point, not a
problem.

### Diff colours are applied to Fragments items and to the overlay drawing

On entering Diff mode the viewer:

1. computes the diff and maps each status to Fragments local ids through the existing Tag/Name
   lookup;
2. calls `highlight` per status: green (`#2e9e4f`) for added, amber (`#e0a100`) for changed, and a
   pale grey at about 0.35 opacity for unchanged;
3. rebuilds the plan-style overlays for the shown storeys with a per-id colour map passed to
   `renderFloor` and `renderWallTops`. Added and changed tops and fills take their status colour;
   unchanged ones take a lighter tint of their normal colour.

Leaving Diff mode calls `resetHighlight` and rebuilds the overlays without the map.

Opening voids carry no Tag and stay uncoloured. A new door shows green in a wall that otherwise stays
grey, and that marks the opening well enough.

Unchanged elements are see-through, not just greyed, so that an amber window on the far side of the
building can be seen from a corner view. Faded elements still write depth, so the scene doesn't turn
into an unordered stack of transparent surfaces. Added and changed elements are drawn after them.
How well the two transparency passes sort is the main thing to eye-check.

Alternatives considered:
- **`setColor` only.** It leaves unchanged elements at full strength, and they hide the changes.
- **Hiding unchanged elements.** It loses the context that makes an extension legible.
- **Swapping to the IFC style in Diff mode.** It loses the plan-style top view, which is where a
  plan-reader looks first.

### Ghosts come from the base model ELM-15 already keeps loaded

ELM-15 keeps every shown revision of the current model loaded, Existing included, in `resident`, and
disposes them when the model changes. The ghosts reuse that entry rather than loading a second copy:

- **Getting the base.** When Diff mode turns on for a revision, the base comes from `resident`. If
  Existing hasn't been shown yet, it is loaded into `resident` the same way a revision is, from
  `out/<base>.ifc`, without being shown. It then stays loaded for the rest of the model's session,
  and is disposed with the rest of the group on a model change.
- **Showing it.** The base's model object is added to the scene beside the revision. Every item
  that isn't removed is hidden, and the removed ones are highlighted in red (`#d64545`) at about 0.45
  opacity. This uses the same IFC-to-Fragments path as the main model, so a demolished wall shows
  with its real openings cut.
- **Putting it back.** Turning Diff off, or switching to another revision, takes the ghost model
  out of the scene again. The base keeps its ghost state while it waits, because the next revision
  re-applies its own. Showing Existing resets the base first (`resetHighlight` and `resetVisible`),
  then applies storey visibility as usual, so the existing building never shows ghost colours.

Storey visibility hides ghosts by storey with the same owner map, built from the base JSON. Hover
picking asks the ghost model as well as `currentModel` in Diff mode, so hovering a ghost names it.
Measurement snapping ignores the ghost model: you can't measure to something that isn't being built.

Alternatives considered:
- **A second, separately loaded and cached copy of the base**, which was this change's first design,
  written before ELM-15 kept revisions loaded. It would hold the base twice whenever Existing had
  been shown, and keep a second cache and its own dispose rules in step with `resident`'s.
- **Drawing removed elements from the base JSON as overlay outlines.** It's lighter, but the result
  isn't the real geometry, and walls would show without their openings.

### Diff is applied while the old picture is held

ELM-15 pauses the renderer for the length of a revision switch, so the canvas keeps the previous
picture until the new revision is complete. With Diff on, "complete" includes the diff. The
colours, the faded unchanged elements and the ghosts are all applied inside that held frame, before
the renderer resumes, so a switch never shows a revision in its normal colours on the way to its diff
colours. Toggling Diff on or off holds the frame the same way, with the same counter, so the toggle
also lands in one picture.

### The panel and the shortcut follow existing patterns

The changes panel reuses the measurement list's styling and position. Clicking a row frames the
element's bounding box with `fitToBox`, in the same direction the camera is looking. If the element's
storey is hidden, it first chooses that storey in the storey selector.

`D` reuses the storey shortcut's guard. Walk mode already binds `D` to strafe (`viewer/walk.ts`), but
the guard ignores the shortcut in walk mode, so the two never meet.

### Diff snapshots are an extra pass in `render`

`snapshot3d` takes an extra query fragment, and `render` calls it a second time for a revision with
`&diff=1`, writing `<name>.3d-diff-<view>.png`. In snapshot mode the panel and button are not shown,
as with the other controls. A missing base IFC is reported back by the page (`window.__elmsteadNote`)
and turned into a WARNING.

### Test models

- **`example-cottage@rear-extension`** from ELM-15 is the end-to-end case for the CLI, the diff file
  and the snapshots. It has one storey, so it can't exercise storey visibility.
- **The storey-visibility and fly-to-a-hidden-storey tests** use the two-storey fixture with a revision
  built in the test with `revise`. The viewer tests already publish JSON and IFC from in-memory
  models, so this needs no model file. The same in-memory approach covers a missing base IFC: publish
  the revision and leave the base out.

## Risks / Trade-offs

- **[Risk]** Fragments' highlight and the viewer's own material patching (plan style patches
  materials for slab tops and stair banding) may fight. → Highlight works per item while the patching
  works per material. Task 3.1 starts with a spike that confirms this on the two-storey fixture, before
  building on it.
- **[Risk]** The two transparency passes sort badly from some angles. → Faded elements write depth,
  and coloured elements render later. If it still reads badly, drop see-through and keep only the
  greying: the colours alone still carry the diff.
- **[Trade-off]** Turning Diff on before Existing has been shown loads the base, which takes as long
  as a revision's first switch. → It happens once per model, and is held behind the previous picture
  like any switch.
- **[Risk]** The base's ghost state, hidden items and red highlights, leaks into Existing. → `load()`
  resets the base before showing it as Existing, and a browser test compares Existing after a Diff
  session with Existing before one, pixel for pixel.
- **[Trade-off]** A lengthened wall is amber as a whole, not new in part. → It is accepted, and
  stated in the docs; see the non-goals.
- **[Risk]** Red and green are hard to tell apart for some viewers. → The three colours differ in
  lightness as well as hue, ghosts are also see-through, and the panel and hover label name the
  status in words.

## Migration Plan

Additive. Base models, their outputs and their snapshots are unchanged. A revision build gains one
file, and its render gains five PNGs. Implement after ELM-15 has merged, then rebase.
