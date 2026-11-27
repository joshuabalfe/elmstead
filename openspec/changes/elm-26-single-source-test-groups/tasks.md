# Tasks

## 1. Before state

- [ ] 1.1 Record the file sets `npm test` and `npm run test:fast` run today (run logs or `--reporter=json`).

## 2. Single source

- [ ] 2.1 Add `vitest.config.ts` with the exported `GROUPS` table (the eleven named groups verbatim, plus `toolchain`) and derived projects, `rest` including everything else with default excludes preserved.
- [ ] 2.2 `package.json`: `test:fast` becomes `vitest run --project rest`.
- [ ] 2.3 `ci.yml`: matrix args become `--project <name>`; add the `toolchain` group; drop rest's `--exclude` block.

## 3. Consistency test

- [ ] 3.1 Rewrite `tests/ci-config.test.ts` to import `GROUPS`: matrix names == project names; the projects partition every test file; named files exist. Delete the exclude-list comparisons and `NEED_UV_OR_CHROMIUM`.
- [ ] 3.2 Verify it fails on a misnamed matrix group and on a file in two groups (temporary edits, reverted).

## 4. Acceptance and docs

- [ ] 4.1 Compare before/after file sets: `npm test` identical (52 files), `test:fast` identical.
- [ ] 4.2 Update `docs/development.md`'s CI section (the table replaces the three-list rule).
- [ ] 4.3 `npm test`, `npm run typecheck`, `npm run format` and `npx openspec validate --all --strict` pass; CI fast + every full shard green.
