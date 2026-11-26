# Design

## Context

See `proposal.md` for the motivation. This change builds on ELM-15, which:
- names revisions `<model>@<revision>` and builds them through the ordinary pipeline;
- keeps element ids, and therefore IFC GlobalIds and `Tag`s, the same across a model and its
  revisions;
- gives the viewer a revision picker and a keep-view load.

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

Both models are indexed by id into `{ kind, storey, json }`, where `json` is the element serialised
with the deterministic formatter. Storeys are indexed with their element arrays left out, so a storey
only changes when its own fields do. Components are indexed under kind `component`. Afterwards, any
opening whose `componentId` is in the changed or added component set, and is not already listed, is
added to `changed`. Ordering follows each model's own order, so the output is deterministic without
sorting, and it reads in the same order as the model files.

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

### The CLI loads the base from the revision's folder

For `<folder>/revisions/<r>.ts`, the CLI loads `<folder>` with the existing `loadModel`. This needs no
build and no checks: the base is evaluated anyway, because the revision imports it. `build` writes
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

### Ghosts come from a second Fragments model of the base

When Diff mode turns on and `out/<base>.ifc` exists, the viewer loads it as a second Fragments model,
guarded by the load epoch like the main model. It hides every item that is not removed, and
highlights the removed ones in red (`#d64545`) at about 0.45 opacity. This uses the same IFC-to-
Fragments path as the main model, so a demolished wall shows with its real openings cut.

The base model is cached while the viewer stays on the same model group. Flicking between revisions
then doesn't re-convert it. It is disposed on a model change or when Diff mode turns off.

Storey visibility hides ghosts by storey with the same owner map, built from the base JSON. The
raycaster picks from both models in Diff mode, so hovering a ghost names it. Measurement snapping
ignores the ghost model: you can't measure to something that isn't being built.

Alternatives considered:
- **Drawing removed elements from the base JSON as overlay outlines.** It's lighter, but the result
  isn't the real geometry, and walls would show without their openings.
- **Loading the base IFC on every revision load.** It wastes time when Diff mode is off.

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

## Risks / Trade-offs

- **[Risk]** Fragments' highlight and the viewer's own material patching (plan style patches
  materials for slab tops and stair banding) may fight. → Highlight works per item while the patching
  works per material. Task 3.1 starts with a spike that confirms this on a two-storey model, before
  building on it.
- **[Risk]** The two transparency passes sort badly from some angles. → Faded elements write depth,
  and coloured elements render later. If it still reads badly, drop see-through and keep only the
  greying: the colours alone still carry the diff.
- **[Trade-off]** A second Fragments model costs memory and load time in Diff mode. → It is only
  loaded while Diff is on, and cached for the group. These are small models.
- **[Trade-off]** A lengthened wall is amber as a whole, not new in part. → It is accepted, and
  stated in the docs; see the non-goals.
- **[Risk]** Red and green are hard to tell apart for some viewers. → The three colours differ in
  lightness as well as hue, ghosts are also see-through, and the panel and hover label name the
  status in words.

## Migration Plan

Additive. Base models, their outputs and their snapshots are unchanged. A revision build gains one
file, and its render gains five PNGs. Implement after ELM-15 has merged, then rebase.
