# Proposal

## Why

An agent asked to add an element type works from the ten-step checklist in
`docs/development.md`. The checklist stops at the plan: it says nothing about the 3D viewer, the
diff and revision machinery, or colour. Those are real touch points. ELM-12 (railings) had to
reach the id walk (`src/schema/ids.ts`), revisions (`src/model/revise.ts`), the diff
(`COMPARED` in `src/diff/index.ts`), the IFC and plan colour tables, the viewer's per-kind code in
`viewer/main.ts` and the plan-versus-3D test's ignored colours, none of which the checklist lists.

The plan SVG, the IFC and the viewer are three independent renderings of one model, so a type that
is right in two of them and wrong in the third passes every unit test. Nothing in the repo tells an
agent to decide each treatment up front or how to check the three agree. `AGENTS.md` also lists no
skill for the most common pipeline change.

## What Changes

- Add a repo skill, `.agents/skills/add-support-for-new-element-types/SKILL.md`. It is the order of
  work for adding an element type: agree the shape, decide the IFC, plan, viewer and colour
  treatment before coding, implement each, then verify that the three views agree. It links to
  the docs for detail and does not repeat them.
- Correct the checklist in `docs/development.md` ("Adding a new element type") so it lists every
  touch point: the id walk, revisions, the diff, the viewer, the two colour tables and the
  plan-versus-3D test.
- Document the colour rules where they now live in comments only: the IFC colour must stay clear
  of every `STYLES` entry because the viewer recognises elements by it, and the plan colour must
  stay clear of wall, room and paper unless the element is meant to take part in the plan-versus-3D
  comparison.
- Add the skill to the skills table in `AGENTS.md`.

Nothing in `src/`, `viewer/`, `models/` or the schema changes, so every output stays byte-identical.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is documentation and agent tooling. The pipeline's behaviour and the specs are
unchanged, so the change sets `skip_specs: true`.

## Impact

- New: `.agents/skills/add-support-for-new-element-types/SKILL.md`.
- Edited: `docs/development.md`, `docs/rendering.md` and `docs/ifc.md` where they hold colour or
  presentation rules the skill points at, and the skills table in `AGENTS.md`.
- No dependency, schema, generated-file or output change.
