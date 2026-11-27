# Tasks

## 1. Trace the touch points and correct the docs

- [x] 1.1 Trace every place an element type touches with `git grep -il railing -- src viewer tests docs scripts`, `git show --stat` on the ELM-12 commits, and the handling of stairs, doors and windows for kinds with parts. Verify each file the ELM-12 commits changed outside `models/` and `openspec/` is in the list or recorded as not needed for a new kind.
- [x] 1.2 Rewrite "Adding a new element type" in `docs/development.md` as a complete, ordered list (schema and ids, revisions, diff, helpers, checks, IFC writer and colour, round-trip, plan and colour, viewer, plan-versus-3D, tests, example, docs). Verify every path and symbol it names with `git grep`.
- [x] 1.3 Add the IFC and plan colour rules to `docs/ifc.md` and `docs/rendering.md`, and add railings to `docs/ifc.md`'s list of elements with surface colours. Verify the rules against `src/ifc/styles.ts`, `src/render/style.ts`, `viewer/style-of.ts` and `tests/support/plan-vs-3d.ts`.

## 2. `inspect-the-rendered-output`

- [x] 2.1 Write `.agents/skills/inspect-the-rendered-output/SKILL.md`: producing the plan and 3D PNGs, running the viewer, and what each URL parameter is for. Verify every parameter it names appears in `viewer/main.ts` or `viewer/walk.ts`, and run each command as written.
- [x] 2.2 Following the skill, produce the Elmstead plan, a 3D snapshot and a Diff-mode view of the example cottage's `rear-extension` revision. Verify each output exists and any step that needed more than the skill says is fixed in the skill.

## 3. `add-support-for-new-element-types`

- [x] 3.1 Write `.agents/skills/add-support-for-new-element-types/SKILL.md`: why-not-an-existing-type first, the treatment sheet agreed with the user, the order of work by link to the `docs/development.md` checklist, geometry variants and storey patterns, and the three-step verification linking `inspect-the-rendered-output`. Verify `name` equals the directory and every relative link resolves with `test -e`.
- [x] 3.2 Walk the skill against railings (ELM-12) and against pitched walls (ELM-11) as if they did not exist. Verify the treatment-sheet answers match what was built, and fix the skill or checklist for any mismatch.

## 4. `edit-an-existing-building-model` and `record-model-constraints`

- [x] 4.1 Write `.agents/skills/edit-an-existing-building-model/SKILL.md`: the loop, outlines on wall faces, the hand-off to `add-support-for-new-element-types`, and links to `docs/modelling.md`. Verify the front matter and links as in 3.1.
- [x] 4.2 Write `.agents/skills/record-model-constraints/SKILL.md`: the measurement-and-note rule, where constraints live, reading a failure line, the revision case. Verify each example failure line against the output of `npm run check` on a fixture in `tests/`.
- [x] 4.3 Replay one past model-only pull request (#39 or #47) through `edit-an-existing-building-model`, and a constraint failure through `record-model-constraints`. Verify the skills lead to the same fix and correct any gap.

## 5. `propose-a-model-revision`

- [x] 5.1 Write `.agents/skills/propose-a-model-revision/SKILL.md`: layout, `revise` edits, the revision's constraints, storeys fixed to the base's, build and render by path, reading the diff, and when to make the base parametric. Verify against `models/examples/example-cottage/revisions/` and `docs/modelling.md#revisions`, and run `npm run all` on a revision as the skill says.

## 6. `diagnose-a-failing-check`

- [x] 6.1 List the distinct failure modes from the messages in `src/checks`, `src/constraints`, the round-trip and validator output, the plan-versus-3D failure output and the CLI failure fixtures, with the cause and fix of each. Verify each message string exists with `git grep`. If fewer than about five distinct modes are found, add a short "when a check fails" section to `edit-an-existing-building-model` instead of a skill and record the decision.
- [x] 6.2 Otherwise write `.agents/skills/diagnose-a-failing-check/SKILL.md` from that list. Verify front matter and links as in 3.1, and that each failure fixture in `tests/fixtures` leads to the listed cause.

## 7. Register and check

- [x] 7.1 Add a row for every skill written to the skills table in `AGENTS.md`. Verify the names match the directories and `npx openspec validate --all` passes.
- [x] 7.2 Run `npm test` and `npm run typecheck` and confirm both pass, and that `git status` shows no change under `out/`, `schema/` or `tests/__snapshots__/`.

## 8. Point the docs at the skills

- [x] 8.1 Add a Skills table to `docs/README.md`, and one-line pointers at the top of `docs/modelling.md` (and its Constraints and Revisions sections), `docs/rendering.md` (The viewer) and `docs/getting-started.md` (Reading the output). Verify every link resolves with `test -e`, that each skill named exists, and that no pointer restates a step from the skill.
- [x] 8.2 Run `npm test` and `npm run typecheck`. Verify both pass and `git status` shows no generated-file change.

## 9. Review feedback

- [x] 9.1 Rename `edit-a-building-model` to `edit-an-existing-building-model` everywhere. Verify `git grep edit-a-building-model` finds nothing outside the archive and every skill and docs link still resolves.
- [x] 9.2 Use one vocabulary for the base model (the building as it is) and a revision (a proposed alternative applied to a copy of it) in both skills, the docs and the skill tables. Verify neither skill uses "edit to the base model" for both.
- [x] 9.3 State what a constraint is for (an immovable, real measurement that edits to other dimensions must not break) in `AGENTS.md`, `docs/modelling.md` and `record-model-constraints`. Verify each says so.
- [x] 9.4 Require asking the user before changing, loosening, replacing or removing an existing constraint, in `AGENTS.md`, `docs/modelling.md` and the four skills that touch constraints. Verify each of those files says so.
- [x] 9.5 Run `npm test`, `npm run typecheck` and `npx openspec validate --all`. Verify all pass and `git status` shows no generated-file change.
- [x] 9.6 Self-review the PR against the code: fix the three factual errors it found (ELM-17 listed as needing a schema type, a backwards parenthetical in the checklist intro, an overclaim about which walls the plan-versus-3D comparison skips) and a harness-specific phrase in `inspect-the-rendered-output`. Verify every path and identifier the changed files name exists, and `npm run test:fast` and `npx openspec validate --all` pass.

