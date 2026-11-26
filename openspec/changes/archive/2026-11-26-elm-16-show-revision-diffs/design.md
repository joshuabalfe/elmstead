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
- **Both models come from schema-validated JSON**, so the same element serialises to the same string
  with `JSON.stringify`, which makes comparing the strings an exact equality test.
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

Both models go through the shared `idNodes` walk, indexed by id. The diff adds the element's
`JSON.stringify` to each entry. Both models come from schema-validated JSON, so their keys are in the
same order, and the comparison is exact without the CLI's formatter. The viewer imports the diff, so
importing `src/cli` from it would make the viewer depend on the CLI. Storeys are serialised with their element arrays left out, so
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

`src/diff/` depends only on `schema`, so the viewer can import it as it
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

### Diff colours: GitHub's scheme, a pale fill and a dark outline

Settled with a spike on `example-cottage@rear-extension`, after a first try with solid green and
amber read as too strong. The scheme follows GitHub's diffs: a pale fill with a dark accent of the
same hue, and unchanged context left plain.

| Status | Fill | Accent | Floor |
|---|---|---|---|
| added | `#aceebb` | `#1a7f37` | `#e6ffec` |
| changed | `#fae17d` | `#9a6700` | `#fff8c5` |
| removed | `#ffcecb` | `#cf222e` | `#ffebe9` |

Floors take GitHub's subtler line-background tint. A whole floor in an element's fill was far more
prominent than a window symbol in it: the knocked-through room's floor read as the loudest change in
the plan. GitHub draws a changed line's background subtler than its changed words for the same
reason.

In 3D:
1. The diff maps each status to Fragments local ids through the existing Tag/Name lookup.
2. `highlight` paints each status's items in its fill, once per status and kind, with a `customId`
   such as `diff-added`. Glazing keeps its transparency (`opacity` 0.5, `transparent`).
3. Each changed item is outlined in its accent. Fragments draws every item of one material as a
   single mesh, and it drops the CPU copy of its geometry once it is on the GPU, so the outlines
   can't come from what it draws. They are built from `getItemsGeometry(localIds)`, which returns
   each item's positions, indices and transform: an `EdgesGeometry` per piece, in one group under
   the model's object, rebuilt on each apply.

Leaving Diff mode resets the highlights and removes the outline group.

Opening voids carry no Tag and stay uncoloured. A doorway with no leaf therefore has nothing to colour
in 3D. It shows in the plan drawing instead (next decision).

The spike also settled one worry: highlighting replaces an item's material with a new one that
plan style's shader patches never saw (wall-top colour, slab-top discard, stair bands). Measured
pixel by pixel, re-applying the patches to the new materials changed nothing in any view. The plan
drawing covers the tops from above, and the inside faces of walls hide the floor from a corner. The
one visible loss is the stair banding: a highlighted flight is drawn in its plain fill, but its edge
outlines keep the steps readable. So no re-patching.

Alternatives considered:
- **Solid saturated colours** (green `#2e9e4f`, amber `#e0a100`). These were tried and read as too
  strong.
- **Tinting each element's own colour towards the status colour.** Paler, but a tinted window turned
  mauve, and walls of different colours ended up different greens.
- **1 px outlines.** WebGL ignores line widths, so the outlines are thin. `Line2`, which the measuring
  tool uses, can thicken them if they turn out too faint on a large model.

### The plan drawing carries the diff

In plan style the top view isn't the 3D model: the plan drawing, built from the JSON by
`renderWallTops` and `renderFloor`, covers it. The spike measured highlighting changing 0 pixels from
above. So the diff has to be in the drawing:

- **Drawing nodes carry ids.** Every wall piece, window symbol and door gap already has its
  element's `data-id`. `renderFloor`'s slab and room fills gain one.
- **The viewer recolours by id before `planGeometry`.**
  - Added and changed wall pieces take their status's accent, since plan walls are solid poché and a
    pale wall would vanish against the floor.
  - Window symbols and door gaps take the fill, with accent strokes.
  - Slab and room fills take the floor tint.

  The renderer itself stays colour-agnostic, and the plan SVGs are unchanged.
- **Diff floor fills are their own layer, 1 mm above the floor.** The spike found that coplanar fills
  in the floor layer don't reliably stack in drawing order: a yellow room fill lost to the cream slab
  fill under it, despite being a later run with a larger polygon offset, and lifting it 1 mm fixed it.
  The normal plan never shows this, because room and slab fills are the same cream. Its root cause is
  outside this change; working around it is not.
- **Door swings are drawn above the diff floor layer.** They are part of `renderFloor` and would
  otherwise be hidden, which is what the spike's single raised layer did to the living kitchen's two
  swings.
- **Removed walls and openings** are drawn from the base model's storey, rendered with
  `renderWallTops` and filtered to the removed ids. They are pale red with a dashed red outline (the
  overlay renderer already reads `stroke-dasharray`), 2 mm above the revision's own wall tops, so a
  bricked-up window shows over the wall that now runs through it.
- **Rebuilding.** Turning Diff on or off rebuilds the plan layers for the shown model. That takes a
  few milliseconds, inside the held frame.

### Transparency is its own control, for any model

Transparency is useful without a diff, as an X-ray of the existing building, so it is a separate
toggle rather than part of Diff mode:

- **What it fades.** `setOpacity(ids, 0.35)` on every item that Diff hasn't coloured: all of them on
  Existing or with Diff off, only the unchanged ones with Diff on.
- **In plan style,** the plan drawing's materials are faded to the same opacity, so the toggle shows
  from the top too. On a single storey that looks washed out; with several storeys, the floors above
  become see-through.
- **It carries over:** it is kept across model and revision switches, set by `?xray=1`, and has no
  keyboard shortcut.

### Every shown model is reset, then dressed

ELM-15 keeps revisions loaded. A model coming back must not keep the highlights, fading or outlines of
an earlier session. So applying the view state always starts from `resetHighlight`, `resetOpacity`
and removing the outline group, then applies Diff and Transparency as they now stand. That one apply
function runs at the end of every `load()` and on every toggle.

### Ghosts come from the base model ELM-15 already keeps loaded

ELM-15 keeps every shown revision of the current model loaded, Existing included, in `resident`, and
disposes them when the model changes. The ghosts reuse that entry rather than loading a second copy:

- **Getting the base.** When Diff mode turns on for a revision, the base comes from `resident`. If
  Existing hasn't been shown yet, it is loaded into `resident` the same way a revision is, from
  `out/<base>.ifc`, without being shown. It then stays loaded for the rest of the model's session,
  and is disposed with the rest of the group on a model change.
- **Showing it.** The base's model object is added to the scene beside the revision. Every item
  that isn't removed is hidden, and the removed ones are highlighted in the removed fill (`#ffcecb`)
  at about 0.5 opacity, outlined in `#cf222e` like the other statuses. This uses the same IFC-to-Fragments path as the main model, so a demolished wall shows
  with its real openings cut.
- **Putting it back.** Turning Diff off, or switching to another revision, takes the ghost model
  out of the scene again. The base keeps its ghost state while it waits, because the next revision
  re-applies its own. Showing Existing resets the base first (`resetHighlight` and `resetVisible`),
  then applies storey visibility as usual, so the existing building never shows ghost colours.

Storey visibility hides ghosts by storey with the same owner map, built from the base JSON. Hover
picking asks the ghost model as well as `currentModel` in Diff mode and takes the nearer hit, so
hovering a ghost names it.
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

The changes panel reuses the measurement list's styling, at the top right, clear of the
measurement list and the compass. Clicking a row frames the element in the direction the camera is
looking: `fitToSphere` round its `getMergedBox`, since `fitToBox` would snap to the nearest face. The
list holds only the shown storeys' changes, so a clicked change is always on a shown storey.

`D` reuses the storey shortcut's guard. Walk mode already binds `D` to strafe (`viewer/walk.ts`), but
the guard ignores the shortcut in walk mode, so the two never meet.

### Diff snapshots are an extra pass in `render`

`snapshot3d` takes snapshot variants, each a file-name suffix and URL parameters. For a revision,
`render` asks for the plain variant and a Diff one (`&diff=1`, writing `<name>.3d-diff-<view>.png`),
in one server and browser session. In snapshot mode the panel and button are not shown, as with the
other controls. The CLI checks for the base's IFC itself and reports a WARNING when it is missing,
since it knows the base's name and the page would only have a note to pass back.
`window.__elmsteadNote` still carries the page's own note, for tests.

### Test models

- **`example-cottage@rear-extension`** from ELM-15 is the end-to-end case for the CLI, the diff file
  and the snapshots. It has one storey, so it can't exercise storey visibility.
- **The storey-visibility and fly-to-a-hidden-storey tests** use the two-storey fixture with a revision
  built in the test with `revise`. The viewer tests already publish JSON and IFC from in-memory
  models, so this needs no model file. The same in-memory approach covers a missing base IFC: publish
  the revision and leave the base out.

## Risks / Trade-offs

- **[Risk]** `applyStyle` recognises plan-style materials by colour, across every material
  Fragments holds, and highlight materials join that list. → The diff fills are far from every
  `STYLES` entry. A test asserts each one is classified as no style.
- **[Trade-off]** A highlighted stair loses its tread banding. → Its edge outlines still show the
  steps, and the stair is only highlighted when it is added or changed.
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
