---
name: add-support-for-new-element-types
description: Add a new kind of building element to elmstead, or a new geometry variant of an existing one, so that it is correct in the model, the IFC, the plan drawings and the 3D viewer, including colour. Use when a model needs something the schema cannot express (a chimney, a ramp, a beam, a sloped or curved variant of a wall), when asked to "add support for", "add an element type", "add a field to wall/window/slab", or when edit-an-existing-building-model hits something the schema cannot say. Not for editing a model with the types that exist.
---

# Add support for new element types

The plan SVG, the IFC and the 3D viewer are three separate renderings of one model. An element that
is right in two and wrong in the third passes every unit test. So this work is about deciding what
the element is in each view _before_ writing code, and then checking that the three agree.

Past examples to read first: railings (ELM-12, a new type), pitched walls (ELM-11) and splayed
window reveals (ELM-5) (new variants of existing types), and the external and half-landing storeys
(ELM-10, ELM-17) (patterns that needed no new type). Their archived changes are in
`openspec/changes/archive/`.

## 1. Do you need a new type?

`AGENTS.md`: keep the schema small, and don't invent a type. Try these in order, and stop at the
first that works:

1. **The existing types as they are.** Can a wall, slab, room, stair or opening say it?
2. **A modelling pattern.** A storey below the building for steps and ground (ELM-10, which added
   only a slab `material`) and a half-landing storey (ELM-17, no schema change) use types that
   already exist; those changes wrote the intent down.
3. **An optional field on an existing type.** `Window.reveal`, `Wall.profile` and `Slab.material`
   were all added this way. A model without the field must produce byte-identical output.
4. **A new element type.** Only when none of the above can say it without misdescribing the
   building in the IFC, plan or 3D. A railing is not a thin wall: it would write a solid
   `IfcWall` and draw the wall treatment.

This is a change to the pipeline, so it is an OpenSpec change (`openspec-propose`). Its proposal
must say why an existing type cannot express the thing (`openspec/config.yaml`). Agree the shape
with the user before building.

## 2. Fill in the treatment sheet, and agree it

Answer each before any code. These are the decisions that are expensive to find out late.

- **Shape.** The fields, each length an `Mm`, and which are optional. Where it lives (which storey
  collection). Whether it has parts with ids of their own, as a stair has flights.
- **IFC.** The IFC4 entity and `PredefinedType`. Spatial containment. How its geometry is built
  (extruded, swept, boolean). Whether it cuts or fills an opening or hangs from a wall. Whether the
  round-trip volume check applies.
- **Plan.** Cut at the plan height, shown beyond it, or symbolic. Its place in the draw order (it
  paints over or under walls and rooms). Its `class` and `data-id`. Whether it widens the drawing's
  extent: the plan sheet and the viewer's plan overlay can differ (railings widen the sheet only).
- **Viewer.** Its IFC colour is how the viewer recognises it. Does it keep that colour, or get the
  plan recolour in plan style (as walls' tops, slabs and stair bands do)? Which storey hides it?
  Does it enlarge the shown bounds or the storey's height?
- **Checks.** What must be true of it and its neighbours: it fits its host, does not overlap,
  has a length, spans what it must (pitched walls: the profile spans the wall and an opening fits
  under the top edge). These become rules in `src/backend/checks/`.
- **Colour.** One IFC colour and one plan colour. Rules in [IFC colours](../../../docs/ifc.md#colours)
  and [plan colours](../../../docs/rendering.md#colours): the IFC one far from every `STYLES` entry,
  the plan one clear of wall, room and paper unless it is meant to be compared.
- **Revisions and the diff.** Can a revision add, change and remove it? Add it to the element-kind
  table; revisions, the diff and the viewer's storey ownership take it from there.
- **Plan-versus-3D.** Compared, or exempt? An element that is exempt, or a storey that is skipped,
  is a decision, with a reason.

Write the sheet into the change's `design.md`.

## 3. Build it, in order

Follow the checklist in
[Adding a new element type](../../../docs/development.md#adding-a-new-element-type). It lists every
file, in order; it replaced an earlier list that stopped at the plan. Find the
nearest existing kind and `git grep` for its name (`railing` for a thing on a storey, `reveal` for a
variant of an opening) to see every place it is handled. A place that handles stairs, slabs or
rooms and not your kind is a gap, or needs a stated reason.

Traps that have each cost a change:

- **A storey collection missing from `STOREY_KINDS`**, or a kind missing from the `IdNode` union,
  fails typecheck. Keep the table the only enumeration; a parallel list is how kinds get missed.
- **An IFC colour near `wall`, `slab` or `ground`** gets its tops painted charcoal or discarded in
  plan style.
- **A plan colour near wall, room or paper** is wrongly counted by the plan-versus-3D comparison;
  one that is far from all three is silently skipped by it.
- **A pitched wall** (one with a `profile`, ELM-11), or a storey whose walls span under 2 m either
  way (ELM-17), makes the plan-versus-3D comparison skip the whole storey (`comparable` in
  `tests/support/plan-compare.ts`). If your variant needs the same, say so in the docs.
- **Generated files.** `npm run schema` regenerates the JSON Schema; the plan snapshot is updated
  with `npx vitest run -u` after you review the diff. Never edit either by hand.
- **Determinism.** No timestamps, random numbers or unordered iteration in anything written to
  `out/`.

## 4. Verify the three views agree

1. **Tests and checks.** `npm test` and `npm run typecheck`. Add a model that uses the element (the
   example cottage or a fixture), and tests for each place you touched.
2. **The comparison.** `tests/plan-vs-3d*.test.ts` either compares the element or you have made it
   an explicit exception.
3. **Look.** Use [inspect-the-rendered-output](../inspect-the-rendered-output/SKILL.md): the plan
   PNG, the 3D PNGs, the element's storey alone (`storeys=`), plan style and `style=ifc`, and, for
   a revision that adds it, Diff mode. The first two passing does not replace this one: colour,
   draw order and recolouring are only visible by looking.

Then update [modelling.md](../../../docs/modelling.md), [ifc.md](../../../docs/ifc.md) and
[rendering.md](../../../docs/rendering.md), and finish the OpenSpec change
(`openspec-apply-change`, `openspec-archive-change`).

## Related skills

- Using the types that exist: [edit-an-existing-building-model](../edit-an-existing-building-model/SKILL.md).
- Real measurements: [record-model-constraints](../record-model-constraints/SKILL.md).
