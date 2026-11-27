# model-revisions Specification

## Purpose

Revisions are named variants of a folder model, such as proposed extensions or alterations. Each is
written as explicit edits to the base model's geometry and constraints, and is built through the
same pipeline under its own output name.

## Requirements

### Requirement: Revisions live beside their model

A folder model's revisions SHALL live in its `revisions/` folder. A revision SHALL be either a file
`revisions/<revision>.ts` or a folder `revisions/<revision>/` with an `index.ts`, and SHALL
default-export a `BuildingModel`. A folder revision SHALL be free to contain any structure of files
and folders beneath its `index.ts`.
The revision's name SHALL be its file or folder name, in kebab-case. A single-file model SHALL have
no revisions.

#### Scenario: Single-file revision

- **WHEN** `models/elmstead/revisions/rear-extension.ts` exists
- **THEN** `rear-extension` is a revision of `elmstead`

#### Scenario: Folder revision

- **WHEN** `models/elmstead/revisions/rear-extension/index.ts` exists, importing modules from `ground/` and `first/` beneath it
- **THEN** `rear-extension` is a revision of `elmstead`, and the modules beneath it are not revisions themselves

#### Scenario: Nested base folder

- **WHEN** `models/examples/example-cottage/revisions/porch.ts` exists
- **THEN** `porch` is a revision of `example-cottage`

#### Scenario: Name not kebab-case

- **WHEN** a command is given `models/elmstead/revisions/Rear_Extension.ts`
- **THEN** it reports an ERROR that the revision name must be kebab-case and writes nothing

### Requirement: Revision output names

A revision SHALL be built, checked and rendered by giving its path to `build`, `check`, `render` or
`all`, exactly like a model. The path SHALL be accepted as the revision file, the revision folder,
or its `index.ts`. The revision's outputs SHALL be named `<model>@<revision>`. The base model's name
and outputs SHALL NOT change because it has revisions.

#### Scenario: Building a revision

- **WHEN** `npm run build models/elmstead/revisions/rear-extension` is run on a valid folder revision
- **THEN** it writes `out/elmstead@rear-extension.building.json` and `out/elmstead@rear-extension.ifc`

#### Scenario: Base unaffected

- **WHEN** `npm run build models/elmstead` is run on a model that has revisions
- **THEN** it writes `out/elmstead.building.json` and `out/elmstead.ifc` only

#### Scenario: Rendering a revision

- **WHEN** `npm run render models/elmstead/revisions/rear-extension.ts` is run after building it
- **THEN** its plans and snapshots are written under the name `elmstead@rear-extension`

### Requirement: Revisions are edits on the base

The authoring helpers SHALL offer `revise(base, edits)`. It SHALL return a new `BuildingModel` and
SHALL NOT change `base`. The edits SHALL be able to:

- remove elements or components by id;
- replace an element or component with another of the same id, in the same place;
- add elements to a named storey under an explicitly named collection;
- add components.

Edits SHALL be applied in the order given.

#### Scenario: Remove

- **WHEN** a revision removes `wall-rear-kitchen`
- **THEN** the revision has no element with that id and the base model still has it

#### Scenario: Replace

- **WHEN** a revision replaces `wall-east` with a longer wall of the same id
- **THEN** the revision's `wall-east` is the longer wall, on the same storey and in the same position in the walls list

#### Scenario: Add to a storey

- **WHEN** a revision adds `{ walls: [wallExtNorth], openings: [doorExt] }` to `storey-ground`
- **THEN** the wall is in the ground storey's walls and the door in its openings

#### Scenario: Add a component

- **WHEN** a revision adds a new window component and a window that uses it
- **THEN** the revision builds and the window's component resolves

### Requirement: Edits fail loudly

Loading the revision SHALL fail with an ERROR naming the id when an edit:

- removes or replaces an id the model does not have;
- adds an id that already exists;
- adds to a storey that does not exist;
- replaces an element with a value the replaced element's collection does not accept.

Removing an element SHALL NOT remove what depends on it. The revision SHALL remove or re-host a
removed wall's openings, or the model checks report them.

#### Scenario: Base element renamed

- **WHEN** a revision removes `wall-rear-kitchen` and the base model renames that wall
- **THEN** loading the revision fails with an ERROR naming `wall-rear-kitchen`

#### Scenario: Duplicate id

- **WHEN** a revision adds a wall with an id the base already uses
- **THEN** loading the revision fails with an ERROR naming that id

#### Scenario: Wrong collection

- **WHEN** a revision replaces a wall with a railing of the same id
- **THEN** loading the revision fails with an ERROR naming that id

#### Scenario: Orphaned opening

- **WHEN** a revision removes a wall but not the door hosted in it
- **THEN** the model checks report the door's missing host wall as an ERROR

### Requirement: Revisions keep the base's storeys

A revision SHALL have exactly the base model's storey ids. The edits SHALL NOT add, remove or replace
storeys. A command run on a revision whose storey ids differ from its base's SHALL report an ERROR
naming each missing or extra storey, and SHALL write nothing.

#### Scenario: Storey edit

- **WHEN** a revision tries to remove or replace `storey-attic`
- **THEN** loading the revision fails with an ERROR that revisions cannot change storeys

#### Scenario: Hand-built revision with an extra storey

- **WHEN** a revision's default export has a storey its base does not
- **THEN** the command reports an ERROR naming that storey and writes nothing

### Requirement: Revisions inherit the base's constraints

A revision without its own constraints file SHALL be checked against every constraint of the base
model's constraints file, exactly as the base is. When a base constraint is unmet or cannot be
measured on the revision, the ERROR SHALL say that the revision's constraints file can remove or
replace it.

#### Scenario: Untouched building

- **WHEN** a revision without a constraints file leaves every measured element alone
- **THEN** every base constraint is checked on the revision and met

#### Scenario: Broken by the revision

- **WHEN** a revision without a constraints file removes `wall-rear-kitchen`, which a base constraint measures
- **THEN** the command reports an ERROR against that constraint, naming the missing wall and the revision constraints file that could remove it, and writes nothing

### Requirement: Revision constraints file

A revision's constraints file SHALL be `revisions/<revision>.constraints.ts` for a file revision, or
`constraints.ts` in a folder revision, and SHALL default-export constraint groups. When the file
exists, its groups SHALL be the revision's constraints in place of the base's. They SHALL NOT be
checked on the base or on other revisions.

#### Scenario: Folder revision constraints

- **WHEN** `models/elmstead/revisions/rear-extension/constraints.ts` exists
- **THEN** building that revision checks its groups and not `models/elmstead/constraints.ts` directly

#### Scenario: Base unaffected

- **WHEN** the base model is built
- **THEN** no revision's constraints file is read

### Requirement: Revisions edit constraints explicitly

The constraint helpers SHALL offer `reviseConstraints(base, edits)`, returning new groups without
changing `base`. The edits SHALL be able to:

- remove a constraint by id, with a required note;
- replace a constraint with another of the same id, in the same group;
- add groups.

#### Scenario: Removing a demolished wall's constraint

- **WHEN** the revision constraints file removes `kitchen-rear-wall-length` with the note "rear wall demolished for the extension"
- **THEN** that constraint is not checked on the revision and is still checked on the base

#### Scenario: Proposal dimension

- **WHEN** the revision constraints file adds a group requiring the extension's inside width to be 3600 mm and the revision meets it
- **THEN** building the revision reports that constraint as met

#### Scenario: Replaced measurement

- **WHEN** the revision constraints file replaces `living-width` with a constraint of the same id and a new distance
- **THEN** the revision is checked against the new distance and the base against the old one

#### Scenario: Unknown constraint id

- **WHEN** the revision constraints file removes or replaces an id the base constraints do not have
- **THEN** loading the constraints fails with an ERROR naming that id

#### Scenario: Removal without a note

- **WHEN** a removal gives an empty note
- **THEN** loading the constraints fails with an ERROR naming that id

### Requirement: Revision constraint summary

For a revision, the commands SHALL print one summary line in the model's format, naming the
constraints file that supplied the groups. When that file is the revision's own, the line SHALL add
how many base constraints it removed, replaced and added. `out/<model>@<revision>.constraints.json`
SHALL list the constraints checked on the revision.

#### Scenario: Inherited

- **WHEN** a revision has no constraints file and all 32 base constraints are met
- **THEN** the command prints `constr  models/elmstead/constraints.ts: 32 of 32 met`

#### Scenario: Revised

- **WHEN** the revision's constraints file removes 2 base constraints, replaces 1 and adds 3, and all 33 are met
- **THEN** the command prints `constr  models/elmstead/revisions/rear-extension/constraints.ts: 33 of 33 met (2 removed, 1 replaced, 3 added)`
