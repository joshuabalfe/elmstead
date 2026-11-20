# AGENTS.md

Instructions for coding agents working in this repo.

elmstead is an LLM-editable building model: TypeScript in `models/` → zod-validated JSON → IFC4
→ plan drawings, 3D snapshots and a browser viewer. Start with [docs/](docs/README.md).

## Skills

This repo's skills live in `.agents/skills/<name>/SKILL.md`, whatever agent or harness you are.
Your harness may not load them itself, so before starting a task, list `.agents/skills/` and read
the front matter of each `SKILL.md`. When a skill's description fits the task, read the whole file
and follow it. When the user names a skill (for example `/openspec-propose`), use that one.

## Commands

```sh
npm test                           # vitest; needs uv (IfcOpenShell) and the bundled Chromium
npm run test:fast                  # vitest without uv, Chromium or CLI subprocess tests
npm run typecheck
npm run build  models/<model>.ts   # model → JSON → IFC, with round-trip and IfcOpenShell checks
npm run check  models/<model>.ts   # model checks only; writes nothing
npm run render models/<model>.ts   # plan SVG/PNG and 3D PNGs
npm run all    models/<model>.ts   # build, then render if the build passed
npm run view                       # local viewer
npm run schema                     # regenerate schema/building.schema.json after a schema change
```

Run `npm test` and `npm run typecheck` before every commit. `npm run test:fast` is the quick
feedback loop while iterating.

## Rules

- **Edit models in `models/`.** Change `src/` only when asked to change the pipeline itself.
- **Never edit generated files by hand.** That means `out/` (git-ignored),
  `schema/building.schema.json`, SVG snapshots and IFC. Regenerate them instead. See
  [docs/development.md](docs/development.md#generated-files).
- **Keep the schema small.** If a model needs something the schema can't express, propose a
  new element type and agree its shape before adding it. Don't invent one.
- **Pin dependency versions exactly.** Check the current release before adding or upgrading one.
- **Commit at milestones**, in small runnable steps. Push or open PRs only when asked.

## Changes: OpenSpec

Changes are tracked with [OpenSpec](https://github.com/Fission-AI/OpenSpec), in `openspec/`:

- `openspec/specs/` holds the current behaviour, grouped by capability.
- `openspec/changes/<name>/` holds a change in progress: proposal, delta specs, design and tasks.
- `openspec/changes/archive/` holds completed changes, so the history lives here.

Every change is numbered like a ticket: `elm-<N>-<name>`, for example `elm-2-add-model-constraints`.
To propose one, take N from `openspec/next-change-number`, name the change `elm-<N>-<name>`, and
increment the file in the same commit. Never reuse or renumber a change. If two branches take the
same number, the file conflicts when they merge: the branch merged second takes the next number
and renames its change. `npm test` fails on an unnumbered change, a reused number or a stale
counter.

Start the title of a pull request that proposes or implements a change with its number in upper
case, `ELM-<N>: `, for example `ELM-2: Add model constraints`. Start the title of a pull request
with no OpenSpec change with `ELM-X: `, for example `ELM-X: Fix a typo in the docs`.

For anything beyond a small fix or a model tweak, use the skills in `.agents/skills/`:

| Skill | Use it to |
|---|---|
| `openspec-explore` | think a problem through before proposing anything |
| `openspec-propose` | write a change's proposal, specs, design and tasks |
| `openspec-update-change` | revise a change's artifacts |
| `openspec-apply-change` | implement a change's tasks |
| `openspec-sync-specs` | merge a change's delta specs into `openspec/specs/` |
| `openspec-archive-change` | archive a finished change |

The CLI is a pinned dev dependency. Where a skill runs `openspec …`, use `npx openspec …`.
`npx openspec validate --all` checks every spec and change.
