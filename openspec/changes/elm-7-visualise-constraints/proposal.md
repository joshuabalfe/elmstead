# Proposal

## Why

A model's constraints are checked and reported as text, but there is no way to see where a
measurement sits in the building. When a room is reworked, a failing constraint id such as
`living-width` is hard to place, and a passing one is easy to forget. The viewer already draws the
plan's room labels and dimensions over the model; the measurements the model must keep should be
visible there too.

## What Changes

- `build` SHALL publish each measured constraint's resolved geometry to
  `out/<name>.constraints.json`, beside the building JSON and IFC. It SHALL contain, per
  constraint, its id, its scope, its storey, its two resolved plan points and its required
  distance. The file SHALL be written only when the model has a constraints file.
- The viewer SHALL read that file alongside `building.json` and draw each constraint as a red,
  camera-facing label in the Top and 3D views, at the midpoint of the span its measurement covers,
  on its storey, at the same height as the room labels. A label SHALL show the constraint id and
  its required distance. A red dotted line SHALL show that same span at the same height: straight
  between the points, along x or y, or projected along the wall the constraint is measured on.
- Constraint labels and lines SHALL have their own **Constraints** button and `?constraints=0|1`,
  independent of the **Labels** button for room labels and dimensions. Constraints SHALL start
  hidden and show only when the button is pressed or `?constraints=1` is given; room labels keep
  their current on-by-default, off-in-snapshots behaviour.
- Constraints SHALL still not appear in `building.json`, the exported JSON Schema or the IFC.
- Out of scope: arrowheads or endpoint markers, showing a failed constraint in a viewer whose
  build was refused, and any change to how constraints are checked or to the building schema.

## Capabilities

### New Capabilities

<!-- None: this extends existing constraint and viewer behaviour. -->

### Modified Capabilities

- `model-constraints`: build publishes the resolved geometry of the constraints it measured, in a
  separate generated file that never enters the building outputs.
- `ifc-viewer`: the viewer draws those resolved constraints as red labels with the other labels.

## Impact

- `src/constraints/` gains a resolved-constraint record and a serialisable drawing shape; the CLI
  writes it in `build`.
- `viewer/main.ts` loads `out/<name>.constraints.json` into its own red layer with a **Constraints**
  button; `viewer/index.html` adds the button.
- New `out/<name>.constraints.json` in the generated files; CLI file-list tests and the viewer
  tests/docs change.
- No new dependencies and no change to the building schema, JSON Schema or IFC bytes.