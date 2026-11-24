# Design

## Context

See `proposal.md` for motivation.

- `src/constraints/resolve.ts` already resolves every point kind to a plan coordinate and measures
  a constraint; `checkConstraints` (`src/constraints/check.ts`) discards the coordinates after
  measuring.
- `build` is the only command that writes `out/<name>.building.json` and `out/<name>.ifc`. It
  checks constraints before writing anything, and writes nothing when a constraint fails.
- The viewer reads `out/<name>.building.json` for room labels, and knows each storey's elevation
  and ceiling from it. Labels live in one `THREE.Group` toggled by the **Labels** button and by
  `?labels=0|1`; snapshots open with labels off.
- Constraints are deliberately kept out of `building.json` and the IFC.

## Goals / Non-Goals

**Goals:**
- Publish resolved constraint geometry without touching the building outputs.
- Draw it over the model, with its own visibility control.
- Keep the layout logic testable without a browser.

**Non-Goals:**
- Showing a constraint that the build refused, or any status on the label.
- Arrowheads or endpoint markers; the span is a plain dotted line.
- Per-constraint visibility; the button controls all of them.

## Decisions

### A separate generated file, written by build

`build` writes `out/<name>.constraints.json` next to the JSON and IFC, and only when the model has
a constraints file and the build is writing its outputs. The file is a JSON array of:

```ts
interface ResolvedConstraint {
  id: string;
  scope: string;             // the group's storey or room id
  storey: string;
  from: { x: number; y: number };   // plan mm, model coordinates
  to: { x: number; y: number };
  span: { from: { x: number; y: number }; to: { x: number; y: number } }; // what the line draws
  distance: number;           // required, whole mm
}
```

Alternatives rejected:
- **Put constraints in `building.json`.** Breaks the existing spec that constraints stay out of the
  building outputs, and makes adding a constraint change the JSON and IFC.
- **Have the viewer resolve the TypeScript constraints itself.** The viewer is a browser page; it
  would need a server-side importer and duplicate the resolver. A generated file keeps the
  pipeline one-way.
- **Write it in `render` too.** `render` does not write `building.json` or the IFC, so it does not
  own what the viewer reads; a standalone `render` can already be looking at an older IFC. Build
  remains the one producer.

`formatJson` gives the file stable formatting, so it diffs like `building.json`.

The `span` is what the viewer draws: `from`→`to` for a straight measure, the x or y difference from
the first point for `x`/`y`, and the projection of `to` from `from` onto the measured wall's
direction for `along`. Publishing it keeps the measurement's direction in one place.

### The check reports what it measured

`ConstraintsReport` gains `resolved: ResolvedConstraint[]`. `checkConstraints` already has the
resolved `from`/`to` and the scope while measuring; recording them there avoids a second pass and a
second copy of the error handling. A constraint that cannot be measured is not recorded, but the
build will not write the file when any ERROR exists, so a written file always lists every
constraint.

The file deliberately leaves out measured distance, tolerance and `note`: the viewer shows the
required distance, and the build only succeeds when every constraint is met, so status would be
redundant. The `scope` is included so the id stays attributable when the file is read on its own.

### A red line and a camera-facing label per constraint

The viewer keeps the constraints in their own `THREE.Group`, controlled by a **Constraints** button
and `?constraints=0|1`. Room labels and dimensions stay under **Labels** / `?labels=0|1`. The two
are independent, so the measurements can be inspected without the room text and hiding the labels
does not hide them. Room labels start on; constraints start off until the button or
`?constraints=1` is used, so the default view stays uncluttered, and snapshots leave both off. Each
label is a sprite built like the room billboards: red text with a paper-coloured halo, drawn with
`depthTest: false` and a `renderOrder` above the room labels so it stays legible over the model
and the room name.

The label is one line, `<id> <distance>`; the distance is bare millimetres, like the plan's
dimension figures. A single line keeps a stack of constraints compact. One sprite is made per
anchor: constraints whose spans share a midpoint (for example a room's width and depth between the
same two corners) share a sprite with one line each, instead of overprinting.

Position and height follow the room labels: the midpoint of `span` in plan, at the storey's
ceiling plus `LABEL_LIFT`. The existing ceiling rule (the tallest wall on the storey) is reused, so
constraint labels sit beside the room names.

Each span is a `Line2` (`three/addons/lines`) with a shared `LineMaterial`: 4 cm thick in world
units, dashed red, `depthTest: false` and a high `renderOrder`, so it reads at any camera distance
and cannot be hidden by walls or the room labels. A plain `THREE.Line` was tried and rejected:
WebGL caps its width at one pixel, which left the thinner spans invisible. One line is drawn per
constraint; constraints with the same span overprint harmlessly.

`src/render/style.ts` gains a `constraint` red (the existing id red), so the colour is named with
the rest of the palette.

### Layout is a pure viewer helper

`viewer/constraints.ts` takes the resolved constraints and a storey id and returns the labels'
text lines and plan anchors, grouping identical midpoints. `viewer/main.ts` only turns those into
sprites. This follows `viewer/walk.ts` and `viewer/view.ts`: the layout is unit-tested in
`tests/viewer.test.ts` without Chromium, and the browser code stays thin.

## Risks / Trade-offs

- [A failing constraint cannot be seen in the viewer, because build writes nothing] → accepted;
  the CLI already reports the failing id and measurement, and showing failed builds would change
  the constraint-gating contract. This change only adds visibility for a passing model.
- [Red labels and lines can overlap room labels or each other] → identical midpoints share one
  sprite, constraint labels draw above room labels, and lines draw below constraint labels.
  Collision layout and leader lines are deferred.
- [Long constraint ids make wide sprites] → one line at the plan's small-label size; the ids are
  kebab-case and the building is several metres across. If it reads badly, a shorter label can be
  chosen without changing the published file.
- [A stale `constraints.json` can outlive a failed build] → the same is already true of the
  building JSON and IFC; the file is regenerated by the next successful build.