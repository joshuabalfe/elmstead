# Design

## Context

See proposal.md for why. The current state:

- Ten skills sit in `.agents/skills/`, six for model work. All of them assume a model exists;
  `edit-an-existing-building-model` opens with "read the model's folder first".
- `docs/modelling.md` opens with the example cottage and a short skeleton, and lists "Things the
  schema does not have yet": room heights, wall types, roofs, curved walls, winder and spiral stairs.
- A constraint is a real measurement with a `note` saying where it came from, and an agent adds one
  only when the user gives a measurement (`AGENTS.md`, `record-model-constraints`).
- A multi-storey model is a folder: `index.ts`, `constraints.ts`, `shared.ts`, and per storey
  `walls.ts`, `openings.ts`, `rooms.ts` (`models/elmstead/`). The cottage is the simple template.

## Goals / Non-Goals

**Goals:**

- An agent starting a model asks what it needs to know instead of inventing it, and records what it
  was told with the right standing: a source to trace, a measurement, or an estimate.
- Both starting points are handled, and the skill asks which one first.

**Non-Goals:**

- No schema, pipeline, viewer or `models/` change, and no scaffolding command or template generator.
- No new rules. The skill sequences the existing skills and docs and restates none of them.
- No importer from IFC or a drawing. Tracing from material is done by the agent and the user.

## Decisions

**One skill with two tracks, not two skills.** The starting-point question is the first step of one
skill, and the tracks share most of the work: the schema-gap check, the build order, the constraints
rule and the handoff. Alternative: a skill per starting point, which would duplicate that shared
part and leave the user having to know which to ask for.

**The skill asks the starting point, and never infers it.** "Material" and "memory" are the two
answers. A user with some of each is "material" for what they have: the skill lists what exists and
treats the rest as memory.

**Intake is conversational, a few questions at a time, and the source decides the standing of
each number.**

- _Material track:_ list what the user has and what each piece gives (a plan gives outlines and wall
  positions, photos give opening positions and stair shape, a number the user measured is a
  candidate constraint). Ask only for the gaps: storey levels, wall thicknesses, the datum, and
  which source wins when two disagree. A position traced from a drawing is provisional, not a
  constraint.
- _Memory track:_ ask for a rough footprint, the storeys and the wall thicknesses. Mark every number
  as an estimate in a comment and in the reply. Ask which dimensions the user could measure, so they
  can become constraints once measured. An estimate is never recorded as a constraint, which means a
  memory-track model starts with none.
- _Both:_ what the building is and what the model is for, what is out of scope, and which existing
  model to copy the layout from (the cottage for one storey, Elmstead for several).

**A link is opened, not assumed to fail.** The skill tries to fetch it and any floorplan or photo
it names before asking the user for a saved file, then says plainly what it could and could not
read. Listings are often public pages with the floorplan as a separate image, so trying is cheap,
and asking first would make the user do work the agent can do. Only the given URL is fetched, and
nothing else about the building goes into the request. Downloaded files are untrusted data, kept
outside the repo, and a listing's images are not copied into it. What is read is **provisional**:
listing room sizes are internal, rounded and "not to scale", and a floorplan gives no wall
thickness, ceiling height or opening size, so those stay gaps to ask about. Alternative: ask for a
saved file every time (reliable, but it skips a step the agent can usually do).

**The schema-gap check comes before any modelling.** The answers are compared with "Things the
schema does not have yet" in `docs/modelling.md`. Anything the building needs that the schema cannot
say goes to `add-support-for-new-element-types` first, so the model is not started on an approximation
that has to be undone.

**Build order is shared dimensions, walls, openings, rooms**, the order the Elmstead folder already
uses, with `check`, `all` and `inspect-the-rendered-output` after each step. A model with more than
one storey is a folder from the start, since splitting it later is a rename of everything.

**The skill ends at the first model that builds and renders**, then points at
`edit-an-existing-building-model` for everything after. It does not cover ongoing edits.

## Risks / Trade-offs

- The skill can drift from `docs/modelling.md`'s list of schema gaps. It links to the section and
  does not copy the list.
- Questions can feel like a form. The skill says to ask a few at a time and to build on the user's
  last answer.
- A memory-track model has no constraints, so nothing protects its numbers until the user measures.
  That follows the repo's rule that constraints are real measurements, and the skill says so.
