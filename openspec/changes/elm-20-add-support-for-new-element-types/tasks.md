# Tasks

## 1. Trace the touch points and correct the docs

- [ ] 1.1 Trace every place an element type touches by running `git grep -il railing -- src viewer tests docs scripts` and `git show --stat` on the ELM-12 commits, plus the nearest stair, door and window handling for kinds with parts, and list each file with why it is touched. Verify every file the ELM-12 commits changed outside `models/` and `openspec/` is either in the list or recorded as not needed for a new kind.
- [ ] 1.2 Rewrite "Adding a new element type" in `docs/development.md` so it lists each traced touch point in dependency order (schema and ids, revisions, diff, helpers, checks, IFC writer and colour, round-trip, plan and colour, viewer, plan-versus-3D, tests, example, docs). Verify each file path and symbol it names exists with `git grep`.
- [ ] 1.3 Add the IFC and plan colour rules to `docs/ifc.md` and `docs/rendering.md`: the IFC colour clear of every `STYLES` entry (the viewer matches within 0.02), the plan colour clear of wall, room and paper unless the element joins the plan-versus-3D comparison. Fix `docs/ifc.md`'s list of elements that carry surface colours, which omits railings. Verify the rules match `src/ifc/styles.ts`, `src/render/style.ts`, `viewer/style-of.ts` and `tests/support/plan-vs-3d.ts`.

## 2. Write the skill

- [ ] 2.1 Create `.agents/skills/add-support-for-new-element-types/SKILL.md` with `name` equal to its directory, a `description` that triggers on adding an element type, and the body: why-not-an-existing-type first, the treatment sheet (IFC, plan, viewer, colour, diff and revisions) agreed with the user before coding, the order of work by link to the `docs/development.md` checklist, and the three-step verification. Verify the front matter parses, `name` matches the directory, and every relative link resolves with `test -e`.
- [ ] 2.2 Walk the skill against railings as if they did not exist: fill in the treatment sheet from the skill's questions and confirm the answers match what ELM-12 built (an `IfcRailing` typed by slope, a line with post ticks, the `railing` colours, storey ownership, the diff kind). Verify any mismatch is a fix to the skill or checklist, and record the outcome in the pull request.
- [ ] 2.3 Add a row for the skill to the skills table in `AGENTS.md`. Verify the table lists the directory's name exactly and `npx openspec validate --all` passes.

## 3. Check

- [ ] 3.1 Run `npm test` and `npm run typecheck` and confirm both pass and that no file under `out/`, `schema/` or `tests/__snapshots__/` changed (`git status`).
