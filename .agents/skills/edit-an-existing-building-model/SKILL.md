---
name: edit-an-existing-building-model
description: Change the base model of an existing building in `models/` (Elmstead, the example cottage or another): the building as it is described in the repo. Move, add or resize walls, doors, windows, rooms, slabs, stairs or railings, add a storey, correct a dimension, or fix a failed check. Use for requests like "the kitchen is actually wider", "add the window that is there", "move the stair to where it really is", "trace the first floor". For a proposed alternative that must leave the base alone ("what if we widened the kitchen"), use propose-a-model-revision. Not for changing the pipeline, schema or viewer.
---

# Edit an existing building model

This changes the **base model**: the building as it is. A proposal for how it might change is a
_revision_, which leaves the base untouched ([propose-a-model-revision](../propose-a-model-revision/SKILL.md)).
If you cannot tell which the user means, ask.

A model is TypeScript in `models/` that is checked, built to JSON and IFC, and drawn. You change the
model, and everything else is regenerated. Never edit `out/`, `schema/building.schema.json`, SVG
snapshots or IFC by hand, and change `src/` only if asked to change the pipeline (`AGENTS.md`).

## The loop

```sh
npm run check models/<model>     # model checks and constraints only; fast; writes nothing
npm run all models/<model>       # build, then render if the build passed
```

1. Read the model's folder first. A folder model splits by role, not by room: `shared.ts` (sizes
   every floor uses), then per storey `walls.ts`, `openings.ts`, `rooms.ts`. Change the file that
   owns the thing, and see [Modelling](../../../docs/modelling.md) for the layout.
2. Make one small change, then `check`. It prints each problem as `LEVEL  element-id: message`, and
   the id is the one in the model, so you can go straight to the line.
3. When `check` is clean, `all`, then **look**: the plan PNG for each storey you touched, and a
   3D view. See [inspect-the-rendered-output](../inspect-the-rendered-output/SKILL.md). Use
   `npm run all -- --ids models/<model>` to see element ids on the plan.
4. Before you commit, `npm test` and `npm run typecheck`. Commit small, runnable steps.

## Rules that catch people

- **Units.** Lengths are integer millimetres: `mm(200)`, `m(2.4)`. A bare number is a type error.
  Do arithmetic with `add`, `sub`, `scale`, `div`, not `+`.
- **Coordinates.** x is east, y is north, per storey. Heights are up from the storey's `elevation`.
  The floor structure belongs to the storey above it; see Coordinates in the modelling doc before
  moving a floor level.
- **Ids.** Lower-case kebab, prefixed by kind (`wall-`, `door-`, `room-`), unique across the whole
  model, and _stable_: the IFC GlobalId comes from the id, so renaming makes a different element.
  Renaming is for when the user asks.
- **Derive, don't hard-code.** Take room corners from `face(wall, side)`, centre openings with
  `centredOn`, and use a named size (`extWallT`) once. Then a changed wall thickness moves the rooms
  and a changed room moves its windows.
- **Room outlines run along wall faces, not wall centrelines.** A room drawn to a centreline gives a
  plan and a 3D view that disagree (the plan-versus-3D test catches it, in a door gap). Use `face()`.
- **Openings fit.** An opening must lie within its wall's length and height and not overlap another
  on the same wall. `check` says which.
- **Pitched or diagonal walls.** `faceCrossing` finds where a face of a wall at an angle meets a
  line. A storey with pitched walls is skipped by the plan-versus-3D comparison.
- **Measurements.** A number the user measured is a constraint ([record-model-constraints](../record-model-constraints/SKILL.md)). A number you traced from a drawing, or guessed, is not:
  say it is provisional in a comment and in your reply. If a constraint fails, fix the model, and
  ask the user before changing, loosening or removing any existing constraint.
- **Tests pin Elmstead.** `tests/elmstead.test.ts` and the plan-versus-3D tests count doors, index
  into `storeys[0]` and list storeys. Adding a storey or a door can break them legitimately. Update
  the expectation deliberately, and say why in the commit.

## When the model needs something the schema cannot say

Stop. Do not approximate it with an existing type. These are not in the schema: room heights, wall
types (external or internal), roofs, curved walls, spiral stairs, and winders anywhere but at the start
of a stair. Neither is anything
else that would make a wall, slab or room misdescribe the building in IFC or on the plan.

Use [add-support-for-new-element-types](../add-support-for-new-element-types/SKILL.md): agree the
shape with the user, then build it through the pipeline. Changes that needed this: ELM-5 (splayed
window reveals), ELM-11 (pitched walls) and ELM-12 (railings).

## Related

- A proposed alteration to an existing building belongs in a revision:
  [propose-a-model-revision](../propose-a-model-revision/SKILL.md).
- A failed check you cannot read: [diagnose-a-failing-check](../diagnose-a-failing-check/SKILL.md).
