# Design

## Context

See `proposal.md` for the motivation. The pieces this change builds on:

- **`src/cli/load.ts`.** `modelName(path)` gives the output name: the file name or, for `index.ts`,
  the folder name. `loadModel` imports the module and validates its default export through JSON.
- **`src/constraints/load.ts`.** `constraintsPath(modelPath)` already gives `constraints.ts` inside a
  folder and `<name>.constraints.ts` beside a file. For a revision path it therefore already finds
  the revision's own constraints file. Constraint ids are kebab-case and unique within a file. Each
  point names elements by id (`src/constraints/resolve.ts`).
- **Ids already have two indexes.** `indexModel` in `src/constraints/resolve.ts` and `idEntries` in
  `src/checks/model.ts` each walk every id in a model. `checkIds` rejects a duplicate id anywhere in
  the model, because ids are the IFC GlobalId keyspace.
- **The viewer.** `viewer/vite.config.ts` serves `/models.json` as the base name of every `out/*.ifc`,
  and the snapshot driver opens `?model=<name>`. `viewer/main.ts`'s `load(name)`:
  - disposes the current Fragments model;
  - loads the IFC and JSON;
  - sets `box` and the grid height from the new model;
  - calls `setView(?view=)`, then re-applies `?camera=` if it is present (`viewer/main.ts:1342-1348`).
- **Example models.** `models/example-cottage/` is already a folder model, with `index.ts` and
  `constraints.ts`. `models/example-two-storey/` has no doors or windows. It exists as the stair
  fixture for `tests/ifc.test.ts`, `plan-vs-3d.test.ts`, `render.test.ts`, `stair.test.ts`,
  `viewer-identify.test.ts` and `fixtures/bad-stair.ts`.

## Goals / Non-Goals

**Goals:**
- Write a revision as an explicit list of edits to geometry and to constraints, so that it reads like
  a description of the works and every departure from the measured building is written down.
- Make a revision an ordinary model to every stage after loading: no schema, IFC or render changes.
- Let a large revision be structured like a large model.
- Switch revisions in the viewer from one viewpoint.
- Lay the naming, loading and id index that ELM-16's diff needs.

**Non-Goals:**
- Computing or drawing the difference between a revision and its base (ELM-16).
- Revisions that add, remove or change storeys.
- A schema-level patch format, or recording a revision's base inside the JSON or IFC.
- Merging revisions, ordering them into phases, or revisions of revisions.

## Decisions

### One id index, in `src/schema/ids.ts`

`indexModel` and `idEntries` become one function, `indexIds(model)`. It returns, for every id, its
kind, its collection path (storey and array, or `components.doors` and so on) and its element.
`checkIds`, constraint resolution and `revise` all use it, and ELM-16's diff will too. It lives in
`schema` because it depends only on the types, and `schema` already sits beneath every other module.
It is a pure refactor and lands first, with the existing tests unchanged.

### A revision is TypeScript that edits the base, with explicit collections

A revision imports the base model's default export and returns `revise(base, [...edits])`:

```ts
import base from "../index.js"; // "../../index.js" from a folder revision
import { revise, remove, replace, addTo, addComponents, wall, door } from "../../../src/model/index.js";

export default revise(base, [
  remove("door-rear-kitchen", "wall-rear-kitchen"),
  replace(wall("wall-east", ...)),
  addTo("storey-ground", { walls: [wall("wall-ext-north", ...)], openings: [door("door-ext", ...)] }),
]);
```

`revise` deep-clones the base and applies the edits in order, using the id index for every lookup.

- **`addTo`** (not `add`, which `src/model` already exports for millimetres) names the collection explicitly (`walls`, `openings`, `slabs`, `rooms`, `stairs`,
  `railings`), so there's no guessing from a value's shape. Today a wall and a railing differ only by
  `thickness`.
- **`replace`** puts the new value at the old one's array index, in the old one's collection, so a
  revision's JSON lists elements in the base's order and diffs stay small.
- **Schema validation.** The value a `replace` puts in a collection is checked against that
  collection's schema when the revision's JSON is validated. The error is reported against the id.
- **Storeys.** `remove` and `replace` reject a storey id, and there is no storey-adding edit.

Alternatives considered:
- **A full copy per revision.** It drifts from the base the first time the base is corrected.
- **A JSON patch (RFC 6902) in the schema.** It addresses array indices, not ids, so it breaks when
  the base reorders anything. It also adds schema for a concern that TypeScript already handles.
- **Fields on each element saying which phase it belongs to.** This makes one model hold every
  proposal at once and needs a filter at every stage. It is a bigger schema change for the same
  result.
- **Inferring the collection from a value's shape.** Rejected as above: fragile today, and wrong as
  soon as two element types share a shape.

### Edits act on values; parametric changes belong in the base

`revise` edits the finished values the base produced, not the variables they were derived from.
That fits additions and demolitions, which are most of what a proposal does. It fits parametric
changes poorly. Moving Elmstead's rear wall 3 m would mean replacing:
- the wall;
- every room traced along it;
- the slabs;
- the opening offsets.

All of that is derived from one variable in `shared.ts`.

The documented answer is to make the base parametric where a revision needs it. The base module
exports a function of the dimensions in question, its default export calls it with the measured
values, and the revision calls it with the proposed ones, then applies `revise` for the rest. This
needs no new machinery, and it keeps the existing building as the default.

There is one hazard to document, which ELM-16 must also handle. An opening is placed by
`offsetAlongWall` from its wall's start. If a revision replaces a wall and moves its start, every
opening in it moves in space while the opening's own JSON stays the same.
- Constraints catch this, because an opening point resolves through its host wall.
- ELM-16's diff must count an opening as changed when its host wall changed.

### Removal does not cascade

Removing a wall does not remove its openings. The revision lists them, which also makes the
demolition explicit. If it doesn't, the existing host-wall check reports the orphaned opening against
its id. Cascading would hide removals from the person reading the revision file, and from ELM-16's
change list.

### Revisions are files or folders under `revisions/`; the name is `<model>@<revision>`

`modelName` recognises three forms, where `<folder>/index.ts` exists:
- `<folder>/revisions/<r>.ts`;
- `<folder>/revisions/<r>/`;
- `<folder>/revisions/<r>/index.ts`.

It returns `<basename(folder)>@<r>`. Files deeper inside a folder revision are never entry points.
A folder under `revisions/` without an `index.ts` isn't a revision, so revisions can share helper
modules from, say, `revisions/shared/`.

`@` cannot appear in a kebab-case name, so the split is unambiguous. It is also safe in file names on
every platform the repo runs on, and needs no escaping beyond what `URLSearchParams` already does.
Everything downstream (`out/` paths, `/models.json`, `?model=`, the snapshot driver, plan file names)
treats it as an opaque name and needs no change.

The JSON's `project` and `building` ids stay as in the base. Nothing records the revision's base
except the name: a field such as `basedOn` would be schema for the viewer's convenience only, and it
could disagree with the folder the revision actually sits in.

The CLI also loads the base model (`<folder>`) for a revision and compares storey ids, reporting
missing and extra ones. `revise` already prevents storey edits, so this catches only a revision built
by hand. It keeps the same-storeys assumption checked, rather than just assumed, for the viewer and
ELM-16.

Alternatives considered: a separate `?revision=` parameter (two parameters to keep in step, and the
snapshot driver would need to learn it); `--` as a separator (ambiguous with kebab-case names).

### Constraints are inherited whole and edited explicitly

The constraints loader resolves, for a revision:

1. **The revision's own file**, found by the existing `constraintsPath(revisionPath)`. If it exists,
   its groups are the revision's constraints. It normally imports the base's groups and returns
   `reviseConstraints(base, [...edits])`:

   ```ts
   import base from "../../constraints.js";
   import { reviseConstraints, removeConstraint, replaceConstraint, addGroups, inRoom, ... } from ".../src/constraints/index.js";

   export default reviseConstraints(base, [
     removeConstraint("kitchen-rear-wall-length", "rear wall demolished for the extension"),
     addGroups(inRoom("room-extension", [{ id: "extension-width", note: "architect's drawing A-102 rev C", ... }])),
   ]);
   ```

2. **Otherwise the base's file**, `<folder>/constraints.ts`, used unchanged.

`reviseConstraints` mirrors `revise`. Removing or replacing an unknown id throws, and so does adding
an existing one. A removal needs a non-empty note. The removal notes are not written anywhere else:
they're for the person reading the file, as every other constraint note is.

Nothing is skipped automatically. Every constraint the revision ends up with is checked, and a
failure gates the command. The ERROR for a constraint that comes from the base file adds "remove or
replace it in `<revision constraints path>`".

The summary line names whichever file supplied the groups. When that is the revision's own file, it
adds the removed, replaced and added counts, which `reviseConstraints` records alongside the groups
it returns under a symbol (`CONSTRAINT_EDITS`). The JSON round-trip drops a symbol, so the counts
never reach the validated groups, and the loader reads them from the module before the round-trip.
`RevisionError` lives in `src/schema/ids.ts`, so the model and constraint loaders both report an
edit that can't be applied against the id it names.

Alternatives considered:
- **Skip, automatically, constraints that reference changed elements.** This was the first draft. It
  silently drops checks on any element a revision touches. It also over-skipped: a reshaped room
  would have taken every wall-only constraint in its group with it, and Elmstead has 13 room-scoped
  groups. Explicit edits replace the referenced-ids machinery entirely.
- **A fully separate constraints file per revision.** It drifts from the base's real measurements.

### The viewer splits names, and loads a revision in place

`/models.json` stays a flat list. The viewer groups it by the part before `@`. The model picker
lists the groups; a second `<select id="revision">` lists "Existing" and the group's revisions in
name order.

`load(name, { keepView })`, for a revision switch:
- still updates `box`, the grid height and the compass from the new model;
- skips `setView` and the `?camera=` re-application;
- keeps `?storeys=` and Ids mode.

Storeys are identical across a model's revisions, so the storey selection carries over as it is.
Measurements are still cleared, because their snapped points belong to the old geometry. Changing
the picker calls `exitWalk()` first, as the model picker does. The load epoch already guards against
a quick double switch.

Arrow Left and Arrow Right follow the storey shortcut's guard, with one difference: while any of the
viewer's `<select>`s has focus, the handler calls `preventDefault`. On Windows and Linux a focused,
closed `<select>` changes its own value on Left and Right. Without `preventDefault`, pressing Right
with the storey selector focused would change the storey as well as the revision. Walk mode already
owns all four arrows, and the guard's walk-mode check covers it.

Alternatives considered:
- **Reloading every revision from its IFC on each switch.** This was the first implementation. It
  takes the switch past a quarter of a second even on a fast GPU, and it is what made the switch
  flicker. The next decision replaces it.
- **`[` and `]` as the shortcut.** These need no `preventDefault`, but they are awkward on non-UK and
  non-US layouts, and the arrows pair naturally with the storey shortcut.

### Switches draw once, and revisions stay loaded

Measured on Elmstead with a GPU (Apple M5 Pro, Metal), a switch that reloads from the IFC took
280–380 ms:
- about 135 ms converting the IFC into Fragments;
- about 95 ms for Fragments' first `update`;
- the rest styling, overlays and the first frame.

Two changes follow from that.

1. **The renderer pauses for the length of a switch.** The canvas is created with
   `preserveDrawingBuffer`, so it keeps showing the old revision until the new one is complete.
   Without the pause the canvas went blank while the IFC converted, and the new model showed several
   half-styled frames while its plan style, storeys and overlays were applied. A counter handles
   overlapping switches.
2. **Each revision of the shown model stays loaded once shown** (`resident` in `viewer/main.ts`). A
   switch takes the shown model out of the scene and puts the chosen one in. Only the cheap per-model
   state is rebuilt from the JSON: overlays, labels, storey visibility and the element-id map. Each
   kept model holds its own stair outlines, which are added once. Hover picking and measure snapping
   only ever ask `currentModel`, so a kept model that is out of the scene can't be picked. Choosing
   another model disposes the previous model's revisions, which keeps memory to one model's worth.
   A rebuild reloads the page, so a kept model can't be stale.

A revision seen before then switches in about 100 ms. Caching the converted Fragments buffer instead,
and reloading from it, was measured too: it saved only about 10%, because Fragments still rebuilds
the model and runs its first `update`.

A stair material captures the shared stair riser when its shader compiles, so a kept model keeps the
riser it was first shown with. Revisions share their base's storeys, so this only matters if a
revision changes a stair's riser count.

### Example models

- **`example-cottage` moves to `models/examples/example-cottage/`.** Its name, and therefore its
  outputs, are unchanged. Every reference moves with it: `README.md`, `docs/`, the tests and their
  fixtures, and the `cli` spec's scenarios.
- **It gets `revisions/rear-extension.ts`,** which:
  - knocks the living room and kitchen through, removing `wall-living-kitchen` and replacing the two
    rooms with one;
  - removes `window-kitchen`;
  - adds a lean-to off the north wall, with a doorway through `wall-north` into it;
  - widens `window-living` by replacing it. Two base constraints measure it, so the revision has
    to revise them; nothing measures `window-bedroom`.

  That covers remove, replace and add, and it breaks some of the cottage's constraints.
- **It gets `revisions/rear-extension.constraints.ts`,** which replaces the two constraints the
  wider window invalidates and adds the lean-to's dimensions, each noted as illustrative like the
  cottage's own constraints. The knocked-through room keeps the id `room-living`, so the living
  room's other constraint still has its room.
- **`example-two-storey` moves to `tests/fixtures/two-storey/`.** It is no longer a model, but its
  six tests keep their stair coverage. `docs/modelling.md`'s stair example points at the fixture, or
  at Elmstead's `ground/stair.ts`.

## Risks / Trade-offs

- **[Risk]** A revision importing the base evaluates the base module, and a command that also loads
  the base, for the storey check, evaluates it again. → `import()` caches modules, and `revise`
  clones before editing, so the base object is never mutated.
- **[Risk]** A revision author mutates a base module's exported object, for example
  `ground.walls.push(...)`, instead of using `revise`. That would corrupt the base within the same
  process. → Document it. `revise`'s clone protects against everything else; freezing the base
  object is a possible follow-up.
- **[Trade-off]** Explicit constraint edits mean a revision that breaks base constraints must list
  them before it builds. → This is intended: it is the same "fix the model, not the constraint"
  discipline, with the edit visible in the revision.
- **[Trade-off]** Building every revision is one command per revision. → Acceptable for now. `all`
  over a folder of revisions is an easy follow-up.
- **[Trade-off]** Measurements do not survive a revision switch. → Snapping is tied to the loaded
  geometry.
- **[Risk]** A rebuild while a revision is shown triggers a full page reload. → The URL keeps
  `?model=` and `?storeys=`, so the reload returns to the same revision. The camera is re-framed, as
  it is today for any rebuild.
- **[Risk]** Moving the example models touches many files. → It's a mechanical rename with no
  behaviour change, landed as its own commit before any revision work, with `npm test` passing.

## Migration Plan

1. Move `example-two-storey` into `tests/fixtures/` and `example-cottage` into `models/examples/`.
   Update the references and commit with `npm test` passing.
2. Extract `indexIds`, a refactor that leaves the existing tests unchanged.
3. Add revisions, revision constraints, then the viewer.

Existing model outputs and URLs are unchanged. A model without a `revisions/` folder behaves exactly
as before, and the revision picker stays hidden.
