# model-diff Specification

## Purpose

Compares a revision with its base model element by element, using their shared ids, so the pipeline
and the viewer can say exactly what a proposal adds, removes and changes.

## Requirements

### Requirement: Elements are matched by id

The diff SHALL match a revision's elements with its base model's by id. The compared kinds SHALL be
walls, openings, slabs, rooms, stairs, railings, storeys and components. A stair SHALL be compared
as a whole, including its segments.

#### Scenario: Same id in both

- **WHEN** the base and the revision both have `wall-west`
- **THEN** the diff compares the two `wall-west` elements with each other

#### Scenario: Renamed element

- **WHEN** a revision removes `window-rear` and adds an identical window as `window-rear-new`
- **THEN** the diff reports `window-rear` as removed and `window-rear-new` as added

### Requirement: Added, removed and changed

An id only in the revision SHALL be added, and an id only in the base SHALL be removed. An id in
both SHALL be changed when the two elements' JSON differs, or when the element is on a different
storey. Otherwise it SHALL be unchanged. Unchanged elements SHALL NOT be listed.

#### Scenario: Added wall

- **WHEN** a revision adds `wall-ext-north` to the ground storey
- **THEN** the diff lists `wall-ext-north` as added, on `storey-ground`

#### Scenario: Removed wall

- **WHEN** a revision removes `wall-rear-kitchen`
- **THEN** the diff lists `wall-rear-kitchen` as removed, on the base storey it was on

#### Scenario: Lengthened wall

- **WHEN** a revision replaces `wall-east` with a longer wall of the same id
- **THEN** the diff lists `wall-east` as changed

#### Scenario: Revision with no edits

- **WHEN** a revision makes no edits to its base
- **THEN** the diff lists nothing as added, removed or changed

### Requirement: Component changes reach their openings

An opening whose component changed SHALL be listed as changed, even when the opening's own JSON
is identical. The component SHALL be listed as changed too.

#### Scenario: New glazing design

- **WHEN** a revision replaces the `front-window` component with a different design and leaves the windows that use it alone
- **THEN** the diff lists `front-window` and every opening using it as changed

### Requirement: Host wall changes reach their openings

An opening whose host wall is changed SHALL be listed as changed, even when the opening's own JSON
is identical, because its position in space is measured along that wall.

#### Scenario: Wall start moved

- **WHEN** a revision replaces `wall-north` with a wall whose start is 500 mm further west, and leaves `window-kitchen` on it alone
- **THEN** the diff lists `wall-north` and `window-kitchen` as changed

#### Scenario: Wall removed

- **WHEN** a revision removes a wall and re-hosts its door on a new wall
- **THEN** the diff lists the wall as removed, the new wall as added and the door as changed

### Requirement: Storeys compare their own fields

A revision has its base's storeys (ELM-15), so storeys SHALL never be added or removed. A storey
SHALL be changed only when its own fields, such as its name or elevation, differ. A change to an
element on a storey SHALL NOT make the storey itself changed.

#### Scenario: Edit on a storey

- **WHEN** a revision adds a wall to `storey-ground` and changes nothing else about the storey
- **THEN** the diff lists the wall as added and does not list `storey-ground`

#### Scenario: Hand-built revision with a raised storey

- **WHEN** a revision's default export keeps every storey id but raises one storey's elevation
- **THEN** the diff lists that storey as changed

### Requirement: Diff file

When `build` writes a revision's outputs, it SHALL also write `out/<model>@<revision>.diff.json`.
The file SHALL name the base and the revision, and list the added, removed and changed elements
with each one's id, kind and storey. It SHALL be formatted like the building JSON and be
byte-identical across builds of the same models. It SHALL NOT be written for a base model, or when
the build writes nothing.

#### Scenario: Revision build

- **WHEN** `npm run build models/elmstead/revisions/rear-extension.ts` succeeds
- **THEN** `out/elmstead@rear-extension.diff.json` lists the revision's added, removed and changed elements

#### Scenario: Folder revision

- **WHEN** `npm run build models/examples/example-cottage/revisions/rear-extension` succeeds on a folder revision
- **THEN** `out/example-cottage@rear-extension.diff.json` is written

#### Scenario: Base build

- **WHEN** `npm run build models/elmstead` succeeds
- **THEN** no diff file is written

#### Scenario: Deterministic

- **WHEN** the same revision is built twice without edits
- **THEN** the two diff files are byte-identical

#### Scenario: Failed build

- **WHEN** a revision's build stops on an ERROR
- **THEN** no diff file is written or changed

### Requirement: Diff summary

`build`, `check` and `all` on a revision SHALL print one line giving the counts:
`diff    <model>@<revision>: <a> added, <c> changed, <r> removed`. The diff SHALL NOT produce ERRORs
or WARNINGs, and SHALL NOT change the exit status.

#### Scenario: Summary line

- **WHEN** `check` runs on a revision that adds 7 elements, changes 3 and removes 2
- **THEN** it prints `diff    elmstead@rear-extension: 7 added, 3 changed, 2 removed`
