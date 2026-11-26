# Design

## Context

See `proposal.md` for the motivation. The pieces this change builds on:

- `src/cli/load.ts`: `modelName(path)` gives the output name, the file name or, for `index.ts`, the
  folder name. `loadModel` imports the module and validates its default export through JSON.
- `src/constraints/load.ts`: `constraintsPath(modelPath)` finds `constraints.ts` or
  `<name>.constraints.ts`. Every constraint point names an element by id. A group can also be scoped
  to a storey or a room by id.
- `viewer/vite.config.ts` serves `/models.json` as the base name of every `out/*.ifc`. The snapshot
  driver opens `?model=<name>`. `viewer/main.ts`'s `load(name)` disposes the current Fragments model,
  loads the new IFC and JSON, then frames the camera from `?view=`.
- Element ids are stable and give the IFC GlobalIds. If a revision keeps an element's id, that
  element keeps its GlobalId in the revision's IFC as well.

## Goals / Non-Goals

**Goals:**
- Write a revision as a short list of edits that reads like a description of the works.
- Make a revision an ordinary model to every stage after loading: no schema, IFC or render changes.
- Switch revisions in the viewer from one viewpoint.
- Lay the naming and loading that ELM-16's diff needs: base and revision are two named outputs whose
  elements share ids.

**Non-Goals:**
- Computing or drawing the difference between a revision and its base (ELM-16).
- A schema-level patch format, or recording a revision's base inside the JSON or IFC.
- Merging revisions, ordering them into phases, or revisions of revisions.

## Decisions

### A revision is TypeScript that edits the base, not a JSON patch or a copy

`models/<model>/revisions/<revision>.ts` imports the base model's default export and returns
`revise(base, [...edits])`:

```ts
import base from "../index.js";
import { revise, remove, replace, add, wall, door } from "../../../src/model/index.js";

export default revise(base, [
  remove("wall-rear-kitchen", "door-rear-kitchen"),
  replace(wall("wall-east", ...)),
  add("storey-ground", wall("wall-ext-north", ...), door("door-ext", ...)),
]);
```

`revise` deep-clones the base and applies the edits in order. It indexes every id-bearing element,
storeys and components included, with its collection and storey. That gives each edit its errors
(unknown id, duplicate id, kind mismatch) and lets `replace` keep an element in its place in its
array, so a revision's JSON lists elements in the base's order and diffs stay small. An edit that
adds an element to a storey appends it to the right collection for its kind. The collection is read
from the value's shape (`kind` for openings and stair segments; the fields that only walls, slabs,
rooms, stairs and railings carry). `add` therefore takes ordinary helper output and needs no
per-kind variants.

Revisions can also use the base's own helper modules. An extension's walls can be built from
`shared.ts`'s thicknesses and faces, which is the real reason to write revisions in TypeScript
rather than JSON.

Alternatives considered:
- **A full copy per revision.** It drifts from the base the first time the base is corrected.
- **A JSON patch (RFC 6902) in the schema.** It addresses array indices, not ids, so it breaks when
  the base reorders anything. It also adds schema for a concern that TypeScript already handles.
- **Fields on each element saying which phase it belongs to.** This makes one model hold every
  proposal at once and needs a filter at every stage. It is a bigger schema change for the same
  result.

### Removal does not cascade

Removing a wall does not remove its openings. The revision lists them, which also makes the
demolition explicit. If it doesn't, the existing host-wall check reports the orphaned opening against
its id. Cascading would hide removals from the person reading the revision file, and from ELM-16's
change list.

### The output name is `<model>@<revision>`, derived from the path

`modelName` recognises `<folder>/revisions/<file>.ts` and returns `<folder>@<file>`. `@` cannot
appear in a kebab-case name, so the split is unambiguous. It is also safe in file names on every
platform the repo runs on, and needs no escaping beyond what `URLSearchParams` already does.
Everything downstream (`out/` paths, `/models.json`, `?model=`, the snapshot driver, plan file names)
treats it as an opaque name and needs no change.

The JSON's `project` and `building` ids stay as in the base. Nothing records the revision's base
except the name. A field such as `basedOn` would be schema for the viewer's convenience only, and it
could disagree with the folder the revision actually sits in.

Alternatives considered: a separate `?revision=` parameter (two parameters to keep in step, and the
snapshot driver would need to learn it); `--` as a separator (ambiguous with kebab-case names).

### Which constraints a revision inherits

The constraints loader learns two things:

1. **The base constraints file.** For `<folder>/revisions/<r>.ts`, this is `<folder>/constraints.ts`.
2. **The ids each constraint references.** This covers both points' element ids, the host wall of
   an opening point, and its group's room scope. A group's storey scope is not an element: the
   storey only has to exist in the revision. If it had to serialise identically, any edit on that
   storey would skip all of its constraints.

A base constraint is checked on the revision when every element it references exists in both
models and serialises identically. Otherwise it is skipped and counted. Comparing serialised JSON
is exact because the JSON is deterministic. It also means a constraint on a wall stays live even
when the revision adds openings to that wall, since an opening is a separate element.

The revision's own `<r>.constraints.ts` is loaded with the existing loader and checked normally.

`<model>@<revision>.constraints.json` concatenates the checked inherited constraints and the own
ones, so the viewer's constraint layer needs no change.

Alternatives considered:
- **Check every base constraint and report failures as WARNINGs.** Noisy, and it hides a real
  regression on an untouched wall among expected failures.
- **Ignore base constraints entirely.** A revision could then silently move an existing wall it
  never meant to touch.

### The viewer splits names, and loads a revision in place

`/models.json` stays a flat list. The viewer groups it by the part before `@`. The model picker
lists the groups; a second `<select id="revision">` lists "Existing" and the group's revisions in
name order.

`load(name)` gains a `keepView` flag. When set, it skips framing and the projection reset, keeps
`?storeys=` (filtered against the new JSON by the existing `parseStoreysParam` fallback), and keeps
Ids mode. A revision switch passes the flag; a model switch does not. Measurements are still cleared,
because their snapped points belong to the old geometry. The load epoch already guards against a
quick double switch.

Arrow Left and Arrow Right reuse the storey shortcut's guard, with the revision picker standing in
for the storey selector. Walk mode already owns all four arrows, so the guard's walk-mode exit covers
it.

Alternatives considered: keeping every revision's Fragments model loaded and toggling visibility.
That would switch faster, but costs memory per revision and complicates hover, ids and storey
visibility, which all assume one model. ELM-16 needs the base loaded alongside a revision for its
ghosts and can introduce a second model there, where it is needed.

### An example revision on `example-two-storey`

The tests need a revision on a real folder model. `example-two-storey` is small and already
exercises two storeys and a stair. Its revision removes an external wall's window, adds a
single-storey lean-to with a door through the existing wall, and widens one ground-floor window.
That covers remove, add and replace in a few lines. A small `example-two-storey/constraints.ts`
gives the inheritance rule something to skip and something to keep.

## Risks / Trade-offs

- **[Risk]** A revision importing `../index.js` runs the base module twice in one process if a
  command loads both. → `import()` caches modules, and `revise` clones before editing, so the base
  object is never mutated.
- **[Risk]** Inferring the collection from a value's shape could misfile a future element type. →
  Inference lives in one function beside the schema, and a test asserts that every schema collection
  is covered, so a new type fails the test until it is mapped.
- **[Trade-off]** Building every revision is one command per revision. → Acceptable for now. `all`
  over a folder of revisions is an easy follow-up if the friction is real.
- **[Trade-off]** Measurements do not survive a revision switch, so the same distance can't be read
  in both versions without measuring twice. → Snapping is tied to the loaded geometry. Re-snapping
  points across models is ELM-16 territory, if wanted at all.
- **[Risk]** A rebuild of the base while a revision is shown triggers a full reload. → The URL keeps
  `?model=` and `?storeys=`, so the reload returns to the same revision. The camera is re-framed, as
  it is today for any rebuild.

## Migration Plan

Additive. Existing models, outputs and URLs are unchanged. A model without a `revisions/` folder
behaves exactly as before, and the revision picker stays hidden.
