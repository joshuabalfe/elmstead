# Proposal

## Why

A model's positions are partly traced from a drawing and partly real measurements from the owner or
a site visit. Both look the same in the TypeScript, so an edit that moves a wall or an opening can
quietly break a measured distance, and nothing in the pipeline notices. We need a way to record the
known real-world dimensions once and have every `check`, `build` and `render` refuse a model that
no longer meets them.

## What Changes

- A model MAY have a **constraints file** beside it: `models/<name>/constraints.ts` for a folder
  model, `models/<name>.constraints.ts` for a single-file model. It default-exports groups of
  constraints. It is separate from the model so whoever edits walls and openings does not edit the
  measurements in the same breath.
- A **constraint** says that the distance between two points in the model is a measured value,
  within a tolerance (default ±10 mm). It says how it was measured: in a straight line, along plan
  x, along plan y, or along a named wall.
- **Points** are named from model ids, never raw coordinates, so they move with the model:
  - where two wall faces meet (a corner);
  - a wall's start or end, on its centre line or on one face;
  - an opening's start jamb, end jamb or centre, on the wall line or on one face;
  - a room outline's corner, by compass direction or by vertex number.
- Constraints are grouped by **storey or room**. A group labels its constraints in messages and
  keeps their points on its storey, and inside a room group a room corner can leave out the room id.
- Constraints are checked with the model checks. A constraint that is not met, or that names an id
  or face the model no longer has, is an ERROR, so `check`, `build`, `render` and `all` fail and
  write nothing. Each command checks constraints once and prints a one-line summary of how many
  were met. A constraints file that fails to load is reported as such, not as a model failure.
- AGENTS.md and `docs/modelling.md` gain a rule: when a constraint fails, change the model, not
  the constraint. Constraints change only when the user gives a new measurement.
- Elmstead gets a constraints file holding only measurements the owner has actually given. So far
  those are sizes, not positions, so corner-to-opening constraints wait for a measured position;
  the example cottage's constraints exercise every point kind meanwhile.
- Out of scope: heights (sill heights, wall heights), constraints on components applied to every
  instance, solving or adjusting the model to meet constraints, and drawing constraints on plans.

No change to the building schema, `building.json`, the exported JSON Schema or the IFC.

## Capabilities

### New Capabilities
- `model-constraints`: the constraints file beside a model, how its points and distances are
  defined and resolved against the model, and how failures are reported and gate the commands.

### Modified Capabilities
<!-- None: the gating is specified in model-constraints so this change does not touch the
     model-checks and cli requirements that elm-1-harden-mvp-pipeline is modifying. -->

## Impact

- New module `src/constraints/` (schema, helpers, loader, resolver, check); `src/cli/index.ts`
  loads constraints after the model and checks them once per command, after the model checks.
- New `models/elmstead/constraints.ts`, and constraints for `models/example-cottage.ts` used as a
  test fixture.
- Docs: `docs/modelling.md`, `AGENTS.md`.
- Builds on `elm-1-harden-mvp-pipeline` (the `check` and `all` commands, `checkModel`, model-wide unique
  ids). That change should be archived before this one, so its specs are the baseline.
- No new dependencies.
