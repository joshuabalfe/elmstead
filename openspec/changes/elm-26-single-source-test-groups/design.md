# Design

## Context

Today the same file lists live in four places:

1. `ci.yml` matrix groups (`args: tests/a.test.ts tests/b.test.ts`),
2. the `rest` group's `--exclude` list (must equal the union of the groups),
3. `package.json` `test:fast`'s `--exclude` list (groups + uv/Chromium files),
4. `ci-config.test.ts`'s `NEED_UV_OR_CHROMIUM` array.

`ci-config.test.ts` regex-parses the YAML and compares the lists. It caught two drifts, but the
fix it enforces is "edit three more places", not "there is one place".

Current partition (must be preserved): plan-vs-3d (2 files), viewer-storey-selection,
viewer-storey-keys, viewer-presentation, viewer-revisions (+ viewer-hot-reload), viewer-diff-mode,
viewer-diff-ghosts, viewer-identify (+ viewer-measure), cli, cli-revisions, cli-diff-snapshots;
rest runs everything else, including ifc, snapshot, toolchain and watch-command, which `test:fast`
additionally excludes.

## Goals / Non-Goals

**Goals**

- One table; fast and CI derive from it; the consistency test checks names and partition, not lists.
- Identical test coverage: `npm test` runs the same 52 files; `test:fast` runs exactly today's set.

**Non-Goals**

- No change to what any test asserts, no new heavy file, no sharding-policy change beyond moving
  the four toolchain files into their own shard.
- No dynamic GitHub matrix generation (a setup job emitting JSON) — the matrix stays static YAML
  with group names only; the consistency test keeps it honest. Simpler, and a name drift is caught
  locally before push.

## Decisions

### D1: vitest projects, not tags or a wrapper

Vitest 5.1.1 supports `test.projects` and `--project <name>` natively. Tags are per-test, not
per-file, and would mean annotating every test; a wrapper script that builds `--exclude` args would
add a tool to maintain. Projects give file-level grouping with zero new dependencies and keep
`npx vitest run -u` and filters working.

### D2: Config shape

```ts
// vitest.config.ts
export const GROUPS: Record<string, string[]> = {
  "plan-vs-3d": ["tests/plan-vs-3d.test.ts", "tests/plan-vs-3d-elmstead.test.ts"],
  // … the eleven named groups, verbatim from today's matrix …
  toolchain: ["tests/ifc.test.ts", "tests/snapshot.test.ts", "tests/toolchain.test.ts", "tests/watch-command.test.ts"],
};
const named = Object.values(GROUPS).flat();
export default defineConfig({
  test: {
    projects: [
      ...Object.entries(GROUPS).map(([name, include]) => ({ test: { name, include } })),
      { test: { name: "rest", include: ["tests/**/*.test.ts"], exclude: [...named, ...DEFAULT_EXCLUDES] } },
    ],
  },
});
```

`rest`'s `exclude` overrides vitest's defaults, so the defaults (`**/node_modules/**`, `**/dist/**`,
…) are re-added explicitly. `GROUPS` is exported for the consistency test.

### D3: Scripts and matrix

- `package.json`: `"test:fast": "vitest run --project rest"`; `"test": "vitest run"` unchanged.
- `ci.yml`: each group's `args` becomes `--project <name>`; add the `toolchain` group; `rest` keeps
  `--passWithNoTests`. The `--exclude` block disappears.

### D4: The consistency test imports, not parses

`ci-config.test.ts` imports `GROUPS` from `vitest.config.ts`, reads `ci.yml` only for the
`- group: <name>` lines, and asserts:

- matrix names (minus none — every project is a shard) == project names;
- every `tests/*.test.ts` on disk is in exactly one project (rest's include/exclude resolved);
- every named file exists.

The YAML regex shrinks to one line matching group names; the exclude-list comparisons and
`NEED_UV_OR_CHROMIUM` are deleted.

### D5: Coverage identity is checked, not assumed

Before/after: list the files `npm test` and `test:fast` run (vitest `--reporter=json` or the run
log) and compare the sets. The acceptance is identical sets, plus the full suite green.

## Risks / Trade-offs

- **Projects change pool/parallelism semantics** — projects share the worker pool; files still run
  one-after-another within a file (the viewer suites rely on this). D5's identity check and the full
  suite on CI prove it; if a project needs its own pool config, set it in the project.
- **One more CI shard** — 13 instead of 12; each shard still ≤ ~2 min. rest loses ~60 s of ifc tests,
  toolchain gains them; total work unchanged, wall-clock likely better.
- **A future vitest upgrade changes projects API** — pinned exactly per repo rule; the consistency
  test and the suite catch breakage on upgrade.

## Acceptance / Migration

1. `npm test` runs the same 52 files / 599 tests; `test:fast` runs exactly today's file set.
2. CI: fast green; every full shard green, including the new toolchain shard.
3. The consistency test fails on a deliberately misnamed matrix group and on a duplicated file
   (checked during implementation, then reverted).
4. docs/development.md's CI section describes the table, not the three lists.
