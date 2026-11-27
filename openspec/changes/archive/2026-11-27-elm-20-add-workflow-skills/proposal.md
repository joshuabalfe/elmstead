# Proposal

## Why

Agents work on elmstead by reading the code and 1,600 lines of docs, and the repo has only the six
OpenSpec skills. The history shows the recurring jobs: editing the Elmstead model to the owner's
measurements (most of the `ELM-X` pull requests), adding an element type or a geometry variant that
must work in the IFC, the plan and the viewer (ELM-4, 5, 10, 11, 12 and 17), proposing alterations as
revisions (ELM-15 and 16), and seeing the result. Each has ordering, judgement calls and traps that
the docs state but do not sequence.

The clearest gap is adding an element. The checklist in `docs/development.md` stops at the plan. It
lists no viewer, diff, revision or colour step, although railings (ELM-12) touched all of them. The
plan SVG, the IFC and the viewer are three independent renderings of one model, so a type that is
right in two and wrong in the third passes every unit test. ELM-11 and ELM-17 each had to change the
plan-versus-3D skip rules for that reason.

## What Changes

Add six skills under `.agents/skills/`, each a short procedure that links to the docs for detail and
restates none of them:

1. `edit-an-existing-building-model`: the edit, check, build, render loop for changing a model in `models/`,
   including outlines on wall faces, and when the work has outgrown the model and needs a new
   element type.
2. `record-model-constraints`: recording a real measurement as a constraint, reading a failing
   one, and fixing the model, not the constraint.
3. `propose-a-model-revision`: writing, checking, rendering and diffing a revision of a folder
   model.
4. `add-support-for-new-element-types`: agreeing the shape, deciding the IFC, plan, viewer and colour
   treatment before coding, then verifying the three views agree. It covers new element types and
   new geometry variants of existing ones (pitched tops, splayed reveals).
5. `diagnose-a-failing-check`: reading a failed model check, constraint, round-trip, IfcOpenShell
   validation or plan-versus-3D comparison and finding the cause in the model.
6. `inspect-the-rendered-output`: seeing the result, meaning the plan PNG, the 3D PNGs and the
   viewer's URL states in headless Chromium. The other skills link to it for their last step.

Also:
- Correct "Adding a new element type" in `docs/development.md` so it lists every touch point: the
  id walk, revisions, the diff, the viewer, both colour tables and the plan-versus-3D test.
- Write the colour rules down where they live only as comments: the IFC colour must stay clear of
  every `STYLES` entry because the viewer recognises elements by it, and the plan colour must stay
  clear of wall, room and paper unless the element joins the plan-versus-3D comparison.
- Fix `docs/ifc.md`'s list of elements that carry surface colours, which omits railings.
- Add the six skills to the skills table in `AGENTS.md`.
- Point the docs at the skills: a Skills table in `docs/README.md` and one-line pointers in
  `docs/modelling.md`, `docs/rendering.md` and `docs/getting-started.md`, so a person or agent that
  starts from the docs finds them.

Nothing in `src/`, `viewer/`, `models/` or the schema changes, so every output stays byte-identical.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is documentation and agent tooling. The pipeline's behaviour and the specs are
unchanged, so the change sets `skip_specs: true`.

## Impact

- New: six directories under `.agents/skills/`, each with a `SKILL.md`.
- Edited: `docs/README.md`, `docs/development.md`, `docs/getting-started.md`, `docs/ifc.md`,
  `docs/modelling.md`, `docs/rendering.md` and the skills table in `AGENTS.md`.
- No dependency, schema, generated-file or output change.
