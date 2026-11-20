# AGENTS.md

Instructions for coding agents working in this repo. Agent skills live in `.agents/skills/`.

elmstead is an LLM-editable building model: TypeScript in `models/` → zod-validated JSON → IFC4
→ plan drawings, 3D snapshots and a browser viewer. Start with [docs/](docs/README.md).

## Commands

```sh
npm test                           # vitest; needs uv (IfcOpenShell) and the bundled Chromium
npm run typecheck
npm run build  models/<model>.ts   # model → JSON → IFC, with round-trip and IfcOpenShell checks
npm run render models/<model>.ts   # plan SVG/PNG and 3D PNGs
npm run view                       # local viewer
npm run schema                     # regenerate schema/building.schema.json after a schema change
```

Run `npm test` and `npm run typecheck` before every commit.

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
