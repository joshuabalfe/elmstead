# Proposal

## Why

The repo has skills for editing, revising and extending a model that exists, and none for the
first job: starting one. `docs/modelling.md` gives a 20-line skeleton and points at the example
cottage, and Elmstead was built up over many changes, so nothing records what has to be known
before the first wall is written.

That is the point where an agent is most likely to guess. Without a source to trace from it invents
wall thicknesses, floor levels and storey heights, and it approximates what the schema cannot say
(roofs, curved walls, wall types, room heights) with the wrong element. The measurements that should
become constraints are also easiest to capture now, while the user is still answering questions,
and `record-model-constraints` only applies once a model exists.

How to start depends on what the user has. With a floor plan, photos or measurements, the model is
traced and the questions are about the gaps and which source wins. With only a description from
memory, there is nothing to trace and every number is an estimate. The skill asks which, first.

## What Changes

- Add the skill `start-a-new-building-model` in `.agents/skills/`. It:
  1. asks the user where they are starting from, before anything else: **material** (a plan,
     sketches, photos, measurements, an old model or IFC) or **memory** (no source documents);
  2. runs intake for that track, a few questions at a time and not as a form, and tries to open
     any link the user gives (such as an estate agent listing and its floorplan) before asking for
     anything else;
  3. checks the answers against the schema's gaps and hands off to
     `add-support-for-new-element-types` before modelling starts, never approximating;
  4. builds in order (shared dimensions, walls, openings, rooms), checking and looking at each
     step, and records constraints only for measurements the user gave;
  5. rechecks the built model against every input it was given, in a table shown to the user,
     before it is called done;
  6. hands off to `edit-an-existing-building-model` once the model builds.
- Add a row for it to the skills table in `AGENTS.md`, and to the Skills table in `docs/README.md`.
- Add a one-line pointer to it in `docs/modelling.md`, beside the pointer to the edit skill.

Nothing in `src/`, `viewer/`, `models/` or the schema changes, so every output stays byte-identical.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is agent tooling and documentation. The pipeline's behaviour and the specs are
unchanged, so the change sets `skip_specs: true`.

## Impact

- New: `.agents/skills/start-a-new-building-model/SKILL.md`.
- Edited: the skills table in `AGENTS.md`, the Skills table in `docs/README.md`, and
  `docs/modelling.md`.
- No dependency, schema, generated-file or output change.
