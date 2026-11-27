# Proposal

## Why

The heavy test files are named in three places that must agree — the CI matrix's groups, the `rest`
group's `--exclude` list, and `test:fast`'s 18-flag `--exclude` list — plus a fourth list
(`NEED_UV_OR_CHROMIUM`) inside `ci-config.test.ts`, which parses the YAML with a regex to keep them
in sync. They have drifted twice (a new browser file ran in the fast job and made it take two
minutes). Adding one heavy test file today means editing three files and satisfying a string-parsing
test; the bookkeeping grows with every viewer feature.

## What Changes

- One **groups table** in a new `vitest.config.ts`; each group becomes a native **vitest project**.
  The projects partition every test file: the eleven named heavy groups, a new `toolchain` group
  (ifc, snapshot, toolchain, watch-command — today's "in rest but not fast" files), and `rest` for
  everything else.
- `npm test` runs all projects — every file exactly once, as today.
- `npm run test:fast` becomes `vitest run --project rest`: the heavy and toolchain files are excluded
  by construction, retiring the 18-flag exclude list.
- The CI matrix runs `--project <name>` per job; the file lists leave the YAML. A new `toolchain`
  shard takes the uv/CLI-subprocess files out of `rest` (rest gets lighter; ifc.test.ts gets its own
  runner instead of sharing rest's).
- `ci-config.test.ts` is rewritten to import the table and assert: matrix group names == project
  names, the groups partition the test files, and every named file exists. No YAML regex, no
  exclude-list comparison.

## Capabilities

### New Capabilities

- `test-grouping`: how the test suite is partitioned into named groups, how the fast suite is
  derived, and how CI runs one job per group with a consistency check.

### Modified Capabilities

(none)

## Impact

- New `vitest.config.ts`; `package.json` (`test:fast`); `.github/workflows/ci.yml` (matrix args,
  one new shard); `tests/ci-config.test.ts` (rewritten); `docs/development.md` (the CI section).
- No new dependencies — vitest 5.1.1 already supports projects and `--project`.
- CI structure: 12 full shards become 13; the per-shard file sets are unchanged except rest loses
  the four toolchain files. Total CI work is the same or less.
- Independent of ELM-23/24/25 (no shared code or spec blocks).
