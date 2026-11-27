---
name: diagnose-a-failing-check
description: Work out why `check`, `build`, `render` or `npm test` failed on a model and what to change. Use when a command prints ERROR or FAILED, a message such as "did not validate", "is not a wall on this storey", "round-trip", "ifcopenshell" or "could not run uv", or a plan-versus-3D test lists bad tiles. Decides whether the cause is the model, a constraint, the pipeline or the environment before anything is edited.
---

# Diagnose a failing check

Every problem is printed as `LEVEL  element-id: message`, and the id is always one of the model's
own element ids (even for IFC validation findings), so you can go straight to the thing. When
anything fails, `build` and `render` write nothing and the command exits 1. Read the **first**
ERROR first: later ones are often consequences.

Decide which side the cause is on _before you change anything_:

| Side                | Looks like                                                                     | You do                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **The model**       | the message is about a wall, door, room, stair, revision edit                  | fix `models/`                                                                                                                    |
| **A constraint**    | `is N mm, should be M ±T mm`                                                   | fix the model, and ask the user before touching the constraint: [record-model-constraints](../record-model-constraints/SKILL.md) |
| **The pipeline**    | the model's own checks passed, then `round-trip:` or an IFC validation finding | do not paper over it in the model; tell the user                                                                                 |
| **The environment** | `could not run uv`, `validator crashed`, Chromium missing                      | fix the setup                                                                                                                    |

`AGENTS.md`: change `src/` only when asked to change the pipeline, and never edit a generated file
or a snapshot to make a failure go away.

## The model

These are real outputs from the repo's failure fixtures in `tests/fixtures/`.

| Output                                                                                                                                                   | Cause and fix                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERROR wall-hall-west: schema: storeys.0.walls.4.thickness: Too small: expected number to be >0`, then `FAILED ... model did not validate`               | A value breaks the schema. The path is `storeys.<n>.<collection>.<n>.<field>` and the id in front is that element. `Unrecognized key` is a typo in a field name: the schema is strict.                      |
| `ERROR door-front: wallId wall-missing is not a wall on this storey`                                                                                     | An opening names a wall that is not on its storey. Fix the id, or the storey the wall is on.                                                                                                                |
| `ERROR door-front: componentId door-type-missing is not in components`                                                                                   | The component is not in the building's `components`.                                                                                                                                                        |
| `ERROR wall-south: zero-length wall cannot be written to IFC`                                                                                            | A wall's `start` equals its `end`. Same for a railing.                                                                                                                                                      |
| `opening is N mm past the wall start` / `past the wall end` / `above the wall top`, `opening overlaps <id>`                                              | The opening does not fit its wall or sits on another. The number is how far; move or shrink it.                                                                                                             |
| `ERROR stair-landing-half: stair-flight-lower ends 100 mm away from this landing`                                                                        | A stair's segments must meet within 1 mm. Move the flight end or the landing outline.                                                                                                                       |
| `frame leaves no leaf` / `leave no glass`                                                                                                                | A component's frame or glazing bars are larger than the opening.                                                                                                                                            |
| `... : model threw while evaluating: ...` or `model has no default export`                                                                               | The model file is not valid TypeScript, or throws. The stack names the line. `mm(1.5)` and `div` throw on a non-whole millimetre.                                                                           |
| `revision: cannot remove wall-rear-kitchen: it is not in the model`, `revisions cannot change storeys`, `the revision's base model ... did not validate` | A revision edit does not match its base, so the base changed under it, or the revision touches a storey. Fix the edit, or the base first: [propose-a-model-revision](../propose-a-model-revision/SKILL.md). |
| A constraints file: `schema: 0.constraints.0: Unrecognized key: "tolerence"`, `constraint id is used twice`, `constraints threw while evaluating`        | The constraints file itself is wrong, which is a different failure from a constraint not being met.                                                                                                         |
| duplicate ids, outline problems (fewer than three points, repeated or crossing points, zero area)                                                        | Ids must be unique across the whole model, including components; outlines must be simple polygons.                                                                                                          |

When the model has an ERROR, `check` is enough to iterate: it is fast and writes nothing.

## The pipeline

The model's own checks passed, then something later fails. The model is probably not wrong.

- `round-trip: web-ifc produced no geometry for this <kind>`, or `volume is not a finite positive
number`: the IFC was written, re-opened and meshed, and the element did not mesh to the volume
  the model implies. Either the element is degenerate in a way the checks do not catch (zero
  thickness part, an outline that collapses), or the IFC writer has a bug for this case. Look at
  the element's numbers, then tell the user; do not nudge the model until the number changes.
- An IfcOpenShell finding (`ERROR <id>: ...` after `valid`): schema, type, inverse or EXPRESS rule
  broken by what the writer produced. The id is the model's. For a new element type this is your
  mapping in `src/backend/ifc/writer.ts`; for an existing one it is a writer bug to report.

## The environment

- `could not run uv — install it with: brew install uv`: `uv` is needed for IFC validation.
- `validator crashed (exit N)` / `validator exited with status N`: the Python validator died. Read
  its stderr in the message; the first run downloads IfcOpenShell, so check the network.
- Render warns the Chromium browser is missing: `npm rebuild @playwright/browser-chromium`. Plans are
  still drawn.
- Render warns there is no IFC: run `build` first (`npm run all` does both).

## A test fails, not a command

`tests/plan-vs-3d*.test.ts` fails with `tiles where the 3D view shows something else than the plan`.
It lists the bad tiles in metres from the south-west corner of the outer walls: go to that spot on
the plan, then look at the plan and the 3D top view
([inspect-the-rendered-output](../inspect-the-rendered-output/SKILL.md)). The usual cause is a room
outline drawn to a wall centreline, not its face (a door gap shows room fill on the plan and white
in 3D). A new element is often the cause too: see the plan colour rules in
[Rendering](../../../docs/rendering.md#colours). Other tests, including snapshot tests, are about
a change you made: read what the assertion compares before touching it, and update an SVG snapshot
only after reviewing its diff (`npx vitest run -u`).
