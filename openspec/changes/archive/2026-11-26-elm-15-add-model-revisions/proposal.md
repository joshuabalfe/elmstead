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

- **Where revisions live.** A folder model can have revisions in its `revisions/` folder, either as
  a single file `revisions/<revision>.ts` or as a folder `revisions/<revision>/index.ts`. A folder
  revision can be structured however a large project needs, as Elmstead itself is.
- **How a revision is written.** A revision default-exports a `BuildingModel`, normally made by
  applying explicit edits to the base model with a new `revise(base, edits)` helper:
  - remove elements by id;
  - replace an element or component with one of the same id;
  - add elements to a storey, naming the collection (`walls`, `openings`, ...);
  - add components.

  An edit that names an id the base doesn't have, or adds an id that already exists, throws. So a
  revision fails loudly when the base changes under it.
- **Storeys stay the same.** In this first iteration a revision has exactly the base's storeys:
  there are no storey edits, and a revision whose storey ids differ from its base's is an ERROR.
- **A revision is built like a model.** `build`, `check`, `render` and `all` take its path. Its
  outputs are named `<model>@<revision>`, e.g. `out/elmstead@rear-extension.ifc`. The base model's
  name and outputs don't change.
- **Constraints are edited explicitly as well.** A revision is checked against the base model's
  constraints by default. A revision constraints file (`revisions/<revision>.constraints.ts`, or
  `constraints.ts` inside a folder revision) can edit them with `reviseConstraints(base, edits)`:
  - remove a constraint by id, with a note saying why;
  - replace one with the same id;
  - add new groups.

  Nothing is skipped automatically. A base constraint that a revision breaks is an ERROR until the
  revision removes or replaces it, so every departure from the measured building is written down.
- **Switching in the viewer.** The viewer groups `<model>@<revision>` names under their model. The
  model picker lists models only. A revision picker next to it lists "Existing" (the base) and each
  revision, and is hidden for a model without revisions. Choosing a revision, or stepping with Arrow
  Left and Arrow Right, loads it in place. The camera, the projection and the shown storeys are kept,
  so you can switch back and forth from one viewpoint. `?model=elmstead@rear-extension` opens a
  revision directly.
- **Example models are reorganised.** `example-cottage` moves to `models/examples/example-cottage/`
  and gets a small example revision, so the tests and docs have one on a real model.
  `example-two-storey` stops being a model: it moves to `tests/fixtures/two-storey/`, where it stays
  the stair fixture for the tests that use it. Elmstead's own revisions wait for the owner's proposal
  drawings.

## Capabilities

### New Capabilities

- `model-revisions`: how a revision is laid out and named, the `revise` edits and their errors, the
  same-storeys rule, and how a revision edits the base's constraints.

### Modified Capabilities

- `ifc-viewer`: the revision picker, in-place switching that keeps the camera and storeys, the
  revision keyboard shortcut, and grouping `/models.json` names by model.
- `cli`: the example paths in its scenarios move to `models/examples/example-cottage`. The behaviour
  itself is unchanged.

## Impact

- `src/schema/` (new `ids.ts`): one id index shared by `checkIds`, constraint resolution and
  `revise`. ELM-16's diff will use it too.
- `src/model/`: the `revise` helper and its edits.
- `src/cli/load.ts`: `modelName` gives `<model>@<revision>` for a file or folder revision. The CLI
  checks that a revision's storeys match its base.
- `src/constraints/`: the `reviseConstraints` helper and its edits. Default inheritance of the base's
  constraints when a revision has no constraints file. A failure message that points at the
  revision's constraints file.
- `viewer/main.ts`, `viewer/index.html`: the revision picker, in-place loading without re-framing,
  and the shortcut. `/models.json` and the snapshot driver stay as they are, because a revision is
  just another name in `out/`.
- **The moved example models.** These are referenced in `README.md`, `docs/`, `tests/` and their
  fixtures, and in the `cli` spec's scenarios.
- `docs/modelling.md` and `docs/rendering.md`: writing revisions, revising constraints, when to make
  the base parametric, and switching between revisions.
- No schema change: a revision's JSON is an ordinary `BuildingModel`, and nothing in the JSON or IFC
  records which model it came from. The `@` in the output name is the only link.
- Out of scope:
  - the diff and its presentation (ELM-16);
  - building every revision with one command;
  - revisions that add or remove storeys;
  - revisions of single-file models (move the model into a folder to give it revisions);
  - revisions of revisions, which nothing forbids in code but which get no special support.
