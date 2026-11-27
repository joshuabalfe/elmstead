# Spec Delta

## Purpose

How the test suite is partitioned into named groups, how the fast suite derives from them, and how CI runs one job per group.

## ADDED Requirements

### Requirement: Test files are partitioned into named groups

The test suite SHALL define its groups once, as a table in the vitest config, and each group SHALL
be a vitest project. Every test file SHALL belong to exactly one project: a named heavy group, the
toolchain group (uv and CLI-subprocess files), or rest. `npm test` SHALL run every test file exactly
once.

#### Scenario: New test file

- **WHEN** a new test file is added that no group names
- **THEN** it runs in rest, and in `npm test`, without editing any list

#### Scenario: No double run

- **WHEN** `npm test` runs
- **THEN** each test file runs exactly once, across all projects

#### Scenario: Missing file

- **WHEN** a group names a test file that does not exist
- **THEN** the consistency test fails

### Requirement: Fast suite is the rest project

`npm run test:fast` SHALL run the rest project, so every named group and the toolchain group is
excluded by construction, with no separate exclude list.

#### Scenario: Fast excludes heavy files

- **WHEN** `npm run test:fast` runs
- **THEN** no browser, uv or CLI-subprocess test file runs

#### Scenario: Fast matches rest

- **WHEN** the rest project's file set is compared with `test:fast`'s runs
- **THEN** they are the same files

### Requirement: CI runs one job per group

The CI matrix SHALL run one job per group with `--project <name>`. A consistency test SHALL assert
that the matrix's group names equal the config's project names and that the groups partition the
test files.

#### Scenario: Group missing from the matrix

- **WHEN** a group is added to the config but not to the CI matrix
- **THEN** the consistency test fails

#### Scenario: Matrix names an unknown group

- **WHEN** the CI matrix names a group the config does not define
- **THEN** the consistency test fails
