---
name: propose-a-model-revision
description: Write, check, build and review a revision of a model, meaning a named proposal or alteration to an existing building (an extension, a knock-through, a wider window, a demolition) written as edits on the base model. Use when asked to "propose", "draft an alternative", "what if we...", "show the change to...", or to see what a change does to the existing building. Not for correcting the building as it is, which is a plain edit to the base model.
---

# Propose a model revision

A revision is a named variant of a **folder model**, written as edits on the base. A correction to
the existing building made in the base reaches every revision without being made twice, so keep
the two apart: "the window is actually 1.1 m" is a base edit
([edit-a-building-model](../edit-a-building-model/SKILL.md)); "widen the window to 1.8 m" is a
revision.

## Where it goes and what it is called

```
models/<model>/
  index.ts                  the building as it is (the base)
  constraints.ts
  revisions/
    knock-through.ts        a file revision: <model>@knock-through
    rear-extension/         a folder revision: <model>@rear-extension
      index.ts              default-exports the revised model
      constraints.ts        (optional) the revision's constraints
```

A real, small one to copy is `models/examples/example-cottage/revisions/rear-extension.ts` with its
`rear-extension.constraints.ts`. Names are kebab-case. A revision has **exactly its base's storeys**:
it cannot add, remove or change a storey (a half-landing or external storey belongs in the base).

## Write it

```ts
import base from "../index.js";
import { addTo, remove, replace, revise } from "../../../../src/model/index.js";

export default revise(base, [
  remove("window-kitchen", "wall-living-kitchen"),
  replace({ ...north, name: "North wall, now inside the lean-to" }),
  addTo("storey-ground", { walls: [/* ... */], openings: [/* ... */] }),
]);
```

- Edits are `remove(...ids)`, `replace(...elements)`, `addTo(storey, { walls, openings, slabs,
  rooms, stairs, railings })` and `addComponents({ doors, windows })`. Always go through `revise`:
  pushing to `ground.walls` in a revision changes the *base itself* for every model in the process.
- An edit that names an id the base does not have, adds one it already has, or puts a value in the
  wrong collection is an ERROR against that id. So a revision breaks loudly if its base changes.
- **Removing does not cascade.** Remove a wall and its openings stay, and `check` reports them. List
  each demolished opening in the revision.
- **Openings move with their wall.** Replacing a wall whose start moved shifts every opening on it.
  Lengthen at the end, or re-place the openings in the same revision.
- Take ids from the base (`ground.walls.find(...)`) and derive from faces (`face`, `centredOn`),
  as for any model.
- If the revision needs to *reshape* the building (move a rear wall that rooms, slabs and openings
  all derive from), editing values is poor: make the base export a function of that dimension and
  call it from the revision ([Modelling](../../../docs/modelling.md#when-to-make-the-base-parametric-instead)).
  That changes the base, so agree it first.

## Its constraints

A revision is checked against its base's constraints, unchanged. When it moves something that was
measured, say so in its own constraints file with `reviseConstraints(base, [...])`:
`removeConstraint(id, why)`, `replaceConstraint({...})`, `addGroups(...)`. A removed or replaced
constraint needs a real source in its `note` (drawings, a survey), like any other
([record-model-constraints](../record-model-constraints/SKILL.md)). Never remove one only to get
past the error. The error names the file to revise it in.

## Build it and read the diff

Build the **base first**: the revision's Diff pictures need the base's IFC to draw removed
elements, and are drawn with a warning without it.

```sh
npm run all models/<model>
npm run all models/<model>/revisions/<revision>.ts    # or the folder path
```

- `diff  <model>@<revision>: N added, N changed, N removed` is printed by `check`, `build` and `all`.
  It never fails the run: adding and removing things is the point. `out/<model>@<revision>.diff.json`
  lists each element.
- A renamed element is both removed (old id) and added (new id). An opening is also changed when
  its host wall or component changes. A stair is compared whole. A lengthened wall is changed whole.
- Outputs are named `<model>@<revision>`. Look at them with
  [inspect-the-rendered-output](../inspect-the-rendered-output/SKILL.md): the plan, the 3D views and
  `.3d-diff-*.png`, then `?model=<model>%40<revision>&diff=1` in the viewer for the changes panel.
  Check the revision changes what you meant and nothing else.

## If it needs something the schema cannot say

Same rule as a model edit: stop, and use
[add-support-for-new-element-types](../add-support-for-new-element-types/SKILL.md).
