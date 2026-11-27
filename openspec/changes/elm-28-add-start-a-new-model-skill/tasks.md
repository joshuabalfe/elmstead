# Tasks

## 1. Write the skill

- [x] 1.1 Write `.agents/skills/start-a-new-building-model/SKILL.md`: the starting-point question first, the material and memory intake tracks, the schema-gap check linking `docs/modelling.md` and `add-support-for-new-element-types`, the build order with `check`, `all` and `inspect-the-rendered-output` after each step, constraints only from user measurements linking `record-model-constraints`, and the handoff to `edit-an-existing-building-model`. Verify `name` equals the directory, the front matter has `name` and `description` only, and every relative link resolves with `test -e`.
- [x] 1.2 Check the skill's claims against the repo. Verify the schema-gap list is linked and not copied, the layout it names matches `models/elmstead/` and `models/examples/example-cottage/`, and each command it shows runs as written.

- [x] 1.3 Add the link step to the Material track: try the link first, fetch only the given URL, fetch the floorplan and photos it names into a directory outside the repo, report what could and could not be read, and treat it all as provisional. Verify the steps read in order and no step asks the user for a file before the link was tried.

## 2. Walk it through both tracks

- [x] 2.1 Follow the skill from the material track with a small made-up floor plan and a stated wall thickness. Build a one-storey model in a scratch folder under the scratchpad, not in `models/`, and run `npm run all` on it. Verify it builds, renders and passes `check`, and fix the skill for any step that needed more than it says.
- [x] 2.2 Follow the skill from the memory track with a description only. Verify every number is marked as an estimate, no constraint is written, and the skill's questions were enough to build without inventing a dimension. Fix the skill for any gap.

## 3. Register and check

- [x] 3.1 Add a row for the skill to the skills table in `AGENTS.md` and to the Skills table in `docs/README.md`, and a one-line pointer in `docs/modelling.md` beside the edit-skill pointer. Verify the name matches the directory, and run `npm run format` so the tables stay aligned.
- [x] 3.2 Run `npx openspec validate --all`, `npm test` and `npm run typecheck`, and confirm they pass and that `git status` shows no change under `src/`, `viewer/`, `models/`, `out/`, `schema/` or `tests/__snapshots__/`.
