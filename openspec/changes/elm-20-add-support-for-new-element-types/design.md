# Design

## Context

See proposal.md for why. The current state:

- `docs/development.md` has a ten-step checklist. Steps 1–7 cover schema, JSON Schema, helpers, IFC
  writer, round-trip, plan and checks. It names no viewer, diff, revision or colour step.
- The repo's last new element type, railings (ELM-12), shows the real surface. Grepping for it finds
  the id walk (`src/schema/ids.ts`: `STOREY_COLLECTIONS` and the `IdNode` union), revisions
  (`src/model/revise.ts`: a schema per collection), the diff (`COMPARED` in `src/diff/index.ts`),
  the checks (`src/checks/model.ts`), geometry shared by writer, round-trip and plan
  (`src/geometry/railing.ts`), the IFC colour table (`src/ifc/styles.ts`), the plan colour table
  (`src/render/style.ts`), and the viewer (`viewer/main.ts`: the storey-owner map and the shown
  bounds).
- Colour is the subtle part. The viewer recognises an element by nearest-matching a material's
  colour against `STYLES` (`viewer/style-of.ts`), so an IFC colour too close to another entry gets
  the wrong presentation. The plan-versus-3D test classifies pixels as wall, room or paper and
  compares only those, so a plan colour near one of them is wrongly compared and one clear of all
  three is silently skipped (`tests/support/plan-vs-3d.ts`).
- The skills directory holds only the six OpenSpec skills. `AGENTS.md` lists each in a table.

## Goals / Non-Goals

**Goals:**
- One skill that gets an agent from "the model needs a new kind of thing" to a type that is correct
  in the IFC, the plan, the 3D viewer and the diff, with no step that only works by luck.
- A checklist in `docs/development.md` that is complete, so a person without the skill has it too.

**Non-Goals:**
- No new element type, schema change or pipeline change.
- No automated check that every id kind is handled everywhere. A test that fails when a kind is
  missing from `COMPARED` or the viewer is worth considering, but it changes behaviour and gets its
  own change.
- No skills for the other candidates (editing a model, constraints, revisions).

## Decisions

**The step list stays in `docs/development.md`, and the skill holds the decisions and the
verification.** The docs are the reference for people and agents alike, so the list of touch points
lives there once. The skill is the procedure around it: what to decide before coding, in what
order, and how to prove the three views agree. Alternatives: put everything in the skill (people
reading `docs/` would miss it, and the two would drift); only extend the checklist (it would still
not say to decide treatments first or how to verify across views).

**Decide the treatment of the element in every view before writing code, and agree it with the
user.** The skill makes the agent write a short treatment sheet and agree it, in the same spirit as
`AGENTS.md`'s "agree the shape first". It answers, for the new element:
- *Why not an existing type.* The repo rule, stated first.
- *IFC:* the IFC4 entity and `PredefinedType`, spatial containment, the geometry (swept, extruded
  or boolean), whether it is solid enough for a round-trip volume check, and how it relates to
  neighbours (does it cut or fill an opening, hang from a wall, sit in a slab).
- *Plan:* whether it is cut, projected above, or symbolic; its place in the draw order; its
  `class` and `data-id`; and whether it counts towards the plan's drawing extent.
- *Viewer:* how it is recognised (its IFC colour in `STYLES`), whether it keeps the IFC colour or
  gets the plan's recolour in the Top view, which storey hides it, and whether it counts towards
  the shown bounds and the walk pose.
- *Colour:* one IFC colour and one plan colour, each checked against its table.
- *Diff and revisions:* whether it is editable by a revision, and that it is compared.
Doing this first matters because the answers decide the code in four places and a wrong one is
found late and in a different file.

**Two colour tables, two rules, written down.** The IFC colour (`src/ifc/styles.ts`) must be well
clear of every other `STYLES` entry, because `styleOfColour` matches within a distance of 0.02.
The plan colour (`src/render/style.ts`) must be clear of wall, room and paper unless the element
should take part in the plan-versus-3D comparison, in which case it is added to the comparison
deliberately. Both rules are today only comments beside the stair and railing entries. They move to
`docs/rendering.md` and `docs/ifc.md`, and the skill links to them. Alternative: a test that
computes the distances. Useful, but it is a behaviour change, so it is out of scope here.

**Verification is three looks, in a fixed order.** (1) Tests and checks: the schema, writer,
round-trip, plan snapshot and `plan-vs-3d` tests pass. (2) The comparison: the new element is
either compared in `plan-vs-3d` or explicitly exempted in `isIgnoredColour` with a reason. (3) An
agent looks at the rendered plan PNG, the 3D PNGs and, for anything visual that tests cannot judge
(colour, draw order, a recolour), the viewer itself. The skill states that the first two passing
does not replace the third.

**Build the touch-point list from the code, not from memory.** Apply grepping for `railing`
across `src/`, `viewer/`, `tests/` and `docs/` and for the files ELM-12 changed. Each place becomes
a checklist line, or is recorded as deliberately unnecessary. This is the method the skill also
tells a future agent to use against the most recent element type.

**Name and place.** `.agents/skills/add-support-for-new-element-types/SKILL.md`, the name the user
asked for, with front matter `name` equal to the directory and a `description` that fires on "add an
element type", "new building element", "support X in IFC, plan and viewer". The repo's other skills
use `license`, `compatibility` and `metadata` fields because they come from OpenSpec's generator;
this one needs only `name` and `description`.

## Risks / Trade-offs

- [The skill repeats the checklist and the two drift] → The skill links to the checklist and
  restates no step. It owns only decisions and verification.
- [The traced list misses a place that railings did not touch but another kind would] → Railings
  are one kind. The trace also reads the other kinds' handling (stairs have a viewer recolour;
  windows and doors have components, so they touch the diff's component kinds) and the skill says
  to grep the nearest existing kind, not only railings.
- [The skill is long enough that agents skim it] → Keep it to the treatment sheet, the order of
  work and the verification, each short.
- [Colour rules documented but unenforced] → Accepted for now; see Non-Goals.
