# Spec Delta

## Purpose

Revisions are named variants of a folder model, such as proposed extensions or alterations. Each is
written as edits on top of the base model and built through the same pipeline under its own output
name.

## ADDED Requirements

### Requirement: Revisions live beside their model
A folder model's revisions SHALL be the `.ts` files in its `revisions/` folder, each default-exporting
a `BuildingModel`, except files ending `.constraints.ts`. A revision's name SHALL be its file name
without the extension and SHALL be kebab-case. A single-file model SHALL have no revisions.

#### Scenario: Revision file
- **WHEN** `models/elmstead/revisions/rear-extension.ts` exists
- **THEN** `rear-extension` is a revision of `elmstead`

#### Scenario: Constraints file is not a revision
- **WHEN** `models/elmstead/revisions/rear-extension.constraints.ts` exists
- **THEN** it is not treated as a revision

#### Scenario: Name not kebab-case
- **WHEN** a command is given `models/elmstead/revisions/Rear_Extension.ts`
- **THEN** it reports an ERROR that the revision name must be kebab-case and writes nothing

### Requirement: Revision output names
A revision SHALL be built, checked and rendered by giving its path to `build`, `check`, `render` or
`all`, exactly like a model. Its outputs SHALL be named `<model>@<revision>`. The base model's name
and outputs SHALL NOT change because it has revisions.

#### Scenario: Building a revision
- **WHEN** `npm run build models/elmstead/revisions/rear-extension.ts` is run on a valid revision
- **THEN** it writes `out/elmstead@rear-extension.building.json` and `out/elmstead@rear-extension.ifc`

#### Scenario: Base unaffected
- **WHEN** `npm run build models/elmstead` is run on a model that has revisions
- **THEN** it writes `out/elmstead.building.json` and `out/elmstead.ifc` only

#### Scenario: Rendering a revision
- **WHEN** `npm run render models/elmstead/revisions/rear-extension.ts` is run after building it
- **THEN** its plans and snapshots are written under the name `elmstead@rear-extension`

### Requirement: Revisions are edits on the base
The authoring helpers SHALL offer `revise(base, edits)`, which returns a new `BuildingModel` without
changing `base`. The edits SHALL be able to remove an element by id, replace an element with another
of the same id and kind on the same storey, add an element to a named storey, add a storey, and add a
component. Edits SHALL be applied in the order given.

#### Scenario: Remove
- **WHEN** a revision removes `wall-rear-kitchen`
- **THEN** the revision has no element with that id and the base model still has it

#### Scenario: Replace
- **WHEN** a revision replaces `wall-east` with a longer wall of the same id
- **THEN** the revision's `wall-east` is the longer wall, on the same storey

#### Scenario: Add to a storey
- **WHEN** a revision adds a wall to `storey-ground`
- **THEN** that wall is in the revision's ground storey

#### Scenario: Add a component
- **WHEN** a revision adds a new window component and a window that uses it
- **THEN** the revision builds and the window's component resolves

### Requirement: Edits fail loudly
An edit that removes or replaces an id the model does not have, replaces an element with one of a
different id or kind, adds an id that already exists, or adds to a storey that does not exist SHALL
make loading the revision fail with an ERROR naming the id. Removing an element SHALL NOT remove what
depends on it: a removed wall's openings SHALL be removed or re-hosted by the revision, or the model
checks report them.

#### Scenario: Base element renamed
- **WHEN** a revision removes `wall-rear-kitchen` and the base model renames that wall
- **THEN** loading the revision fails with an ERROR naming `wall-rear-kitchen`

#### Scenario: Duplicate id
- **WHEN** a revision adds a wall with an id the base already uses
- **THEN** loading the revision fails with an ERROR naming that id

#### Scenario: Orphaned opening
- **WHEN** a revision removes a wall but not the door hosted in it
- **THEN** the model checks report the door's missing host wall as an ERROR

### Requirement: Revisions inherit untouched constraints
A revision SHALL be checked against the base model's constraints whose every referenced element is
present in the revision and unchanged from the base. A constraint that references an element the
revision removed or changed SHALL be skipped, not reported as failing. A group's storey counts as
an element only for being present. Inherited constraints SHALL gate the commands as the base's do.

#### Scenario: Untouched element
- **WHEN** a constraint measures `wall-west`, and a revision leaves `wall-west` unchanged
- **THEN** the constraint is checked on the revision and an unmet one is an ERROR

#### Scenario: Removed element
- **WHEN** a constraint measures from `wall-rear-kitchen`, and a revision removes that wall
- **THEN** the constraint is skipped on the revision

#### Scenario: Edit elsewhere on the storey
- **WHEN** a storey-scoped constraint measures two untouched walls, and the revision adds a wall to that storey
- **THEN** the constraint is still checked on the revision

#### Scenario: Changed element
- **WHEN** a constraint measures a window that a revision replaces with a wider one
- **THEN** the constraint is skipped on the revision

### Requirement: Revision constraints file
When `revisions/<revision>.constraints.ts` exists, it SHALL be read as the revision's own
constraints, in the same format as a model's. They SHALL be checked on the revision alongside the inherited constraints, and SHALL
NOT be checked on the base model or on other revisions.

#### Scenario: Proposal dimension
- **WHEN** `rear-extension.constraints.ts` requires the extension's inside width to be 3600 mm and the revision meets it
- **THEN** building the revision reports that constraint as met

#### Scenario: Base unaffected
- **WHEN** the base model is built
- **THEN** no constraint from any revision's constraints file is checked

### Requirement: Revision constraint summary
For a revision, the commands SHALL print one summary line for the inherited constraints, giving
how many were met and how many were skipped. When the revision has its own constraints file, they
SHALL print a second line for it in the model's summary format.
`out/<model>@<revision>.constraints.json` SHALL list the inherited constraints that were checked and
the revision's own constraints. It SHALL NOT list skipped ones.

#### Scenario: Some skipped
- **WHEN** a revision of a model with 12 constraints changes elements used by 2 of them, and the other 10 are met
- **THEN** the command prints `constr  models/elmstead/constraints.ts: 10 of 10 met, 2 skipped by the revision`

#### Scenario: Own constraints
- **WHEN** the revision also has a constraints file with 3 constraints that are all met
- **THEN** a second line prints `constr  models/elmstead/revisions/rear-extension.constraints.ts: 3 of 3 met`
