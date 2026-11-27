---
name: record-model-constraints
description: Record a real measurement as a constraint on a model, or deal with a constraint that fails. Use when the user gives a measurement ("the window starts 1175 mm from the corner", "the room is 3.1 m wide"), asks to lock a dimension, or `check`, `build` or `render` prints `ERROR` for a constraint (`constr ... met` with a failure). Not for deciding a dimension yourself, or for a number traced from a drawing.
---

# Record model constraints

A constraint is a real measurement that no later edit may quietly break. It lives beside the model,
never in `building.json` or the IFC, and every `check`, `build` and `render` measures it. A broken
one stops the command, writes nothing and exits 1.

## The rule

**When a constraint fails, fix the model, not the constraint.** Add or change a constraint only when
the user gives you a measurement, and put where it came from in its `note` ("from the owner",
"measured on site 12 March"). Do not record a position you traced from a drawing, and do not
loosen the `tolerance` or change the `distance` to make a failure go away (`AGENTS.md`).

## Adding one

1. Get the measurement and its source from the user. If you only have a guess, it is not a
   constraint; say it is provisional.
2. Find the file ([Constraints](../../../docs/modelling.md#constraints) has the detail):
   - a folder model: `constraints.ts` in the folder (`models/elmstead/constraints.ts`);
   - a single-file model: `<name>.constraints.ts` beside it;
   - a revision: its base's, unless it revises them ([propose-a-model-revision](../propose-a-model-revision/SKILL.md)).
3. Add it to the group for its storey or room (`inRoom(...)` or a storey group). Name the two
   points from model ids, never coordinates:

   ```ts
   {
     id: "living-corner-to-window",
     note: "Inside south-west corner to the window's west jamb, from the owner",
     from: corner({ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" }),
     to: jamb("window-living", "start", "left"),
     measure: { along: "wall-south" },
     distance: mm(1175),
   }
   ```
   - Points: `corner`, `wallEnd`, `jamb`, `roomCorner`. Prefer wall-face corners to room corners:
     a room's vertex number changes when its outline gains a point.
   - `measure`: `"straight"`, `"x"`, `"y"`, or `{ along: wallId }` for a tape along a wall. Distances
     are unsigned and in plan only; heights cannot be constrained yet.
   - `tolerance` defaults to 10 mm. Every point must be on the group's storey.
4. `npm run check models/<model>`. The new constraint should be met. If it is not, your model does
   not match what the user measured: that is the finding, so tell them.

## A constraint fails

`check` prints a line per failure and a summary:

```
constr  models/examples/_tmp/constraints.ts: 3 of 6 met
ERROR   living-corner-to-window: is 1125 mm, should be 1175 ±10 mm (room-living)
ERROR   living-width: is 3450 mm, should be 3550 ±10 mm (room-living)
ERROR   bathroom-corner-to-window-centre: is 925 mm, should be 975 ±10 mm (room-bathroom)
```

(That is the example cottage with its external wall thickness changed from 200 to 300 mm. Several
failures at once usually share one cause, so look for the one edit that moved all of them.)

1. Read the id: it names the constraint, and its `note` says what the measurement was. The id in
   brackets is the element or room it is about.
2. Find what the edit moved. The point helpers name wall faces and openings, so the likely cause is
   a wall thickness, an opening's `offsetAlongWall` or `centredOn` target, or a wall end.
3. Change the *model* so the measured distance is met again. If two constraints now disagree with
   each other, the measurements or the model's structure need discussing: ask the user.
4. If a model id in a constraint no longer exists (a rename or deletion), that is an ERROR too. Update
   the constraint's id to the new one only when the same element still exists.
5. To see them: the viewer's **Constraints** button, or `?constraints=1`, draws each in red on the
   model ([inspect-the-rendered-output](../inspect-the-rendered-output/SKILL.md)).

In a revision, a failure from its base's constraints says where the revision can remove or replace
the constraint. Do that only when the revision is meant to change that measured thing.
