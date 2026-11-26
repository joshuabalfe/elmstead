# Proposal

## Why

A model today is one building at one moment. Elmstead models the house as it stands, but the owner
also wants to model the proposed works: a rear extension, a loft conversion, a knocked-through
kitchen. Each of those is the same building with some elements added, removed or reshaped. Copying
the whole model to describe one would mean every later correction to the existing building has to
be made twice, and the copies would drift apart. The viewer can switch between models, but it has
no idea that two of them are the same house, so comparing them means re-framing the camera every
time.

This change adds revisions: named variants of a model, written as edits on top of it, built
through the same pipeline, and switchable in the viewer without losing your place. Showing what a
revision added and removed is ELM-16, which builds on the naming and loading defined here.

## What Changes

- A folder model can have revisions in `models/<model>/revisions/<revision>.ts`. Each one
  default-exports a `BuildingModel`, normally made by applying edits to the base model with a new
  `revise(base, edits)` helper: remove an element by id, replace an element with the same id, add
  an element to a storey, add a storey or a component. An edit that names an id the base does not
  have, or adds an id that already exists, throws, so a revision fails loudly when the base changes
  under it.
- A revision is a model like any other: `build`, `check`, `render` and `all` take its path, and its
  outputs are named `<model>@<revision>`, e.g. `out/elmstead@rear-extension.ifc`. The base model's
  name and outputs do not change.
- Constraints: a revision inherits the base model's constraints, but only those whose referenced
  elements the revision leaves untouched. A constraint on an element the revision removes or
  replaces is skipped and counted in the summary line, because it measures the existing building
  and not the proposal. A revision can also have its own constraints file,
  `revisions/<revision>.constraints.ts`, for dimensions the proposal must meet.
- The viewer groups `<model>@<revision>` names under their model. The model picker lists models
  only. A revision picker next to it lists "Existing" (the base) and each revision, and is hidden
  for a model without revisions. Choosing a revision, or stepping with Arrow Left and Arrow Right,
  loads it in place and keeps the camera, the projection and the shown storeys, so you can switch
  back and forth from one viewpoint. `?model=elmstead@rear-extension` opens a revision directly.
- `models/example-two-storey` gets a small example revision, so tests and docs have one on a real
  model. Elmstead's own revisions wait for the owner's proposal drawings.

## Capabilities

### New Capabilities

- `model-revisions`: how a revision is written and named, the `revise` edits and their errors, and
  which constraints apply to a revision.

### Modified Capabilities

- `ifc-viewer`: the revision picker, in-place switching that keeps the camera and storeys, the
  revision keyboard shortcut, and grouping `/models.json` names by model.

## Impact

- `src/model/`: the `revise` helper and its edit types.
- `src/cli/load.ts`: `modelName` gives `<model>@<revision>` for a file in a model's `revisions/`
  folder.
- `src/constraints/`: the constraints a revision inherits, the per-revision constraints file, and
  the skipped count in the summary.
- `viewer/main.ts`, `viewer/index.html`: the revision picker, in-place loading without re-framing,
  and the shortcut. `/models.json` and the snapshot driver stay as they are, because a revision is
  just another name in `out/`.
- `models/example-two-storey/revisions/`: the example revision.
- `docs/modelling.md` and `docs/rendering.md`: writing revisions and switching between them.
- No schema change: a revision's JSON is an ordinary `BuildingModel`, and nothing in the JSON or IFC
  records which model it came from. The `@` in the output name is the only link.
- Out of scope: the diff and its presentation (ELM-16); building every revision with one command;
  revisions of single-file models (move the model into a folder to give it revisions); and
  revisions of revisions, which nothing forbids in code but which get no special support.
