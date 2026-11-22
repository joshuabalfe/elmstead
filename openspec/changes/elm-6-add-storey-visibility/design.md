# Design

## Context

See `proposal.md` for the motivation. Plan style (`viewer/main.ts`) substitutes a drawing for parts
of the model: `renderFloor`'s room fills for the floor, charcoal for wall tops, `renderWallTops`'
linework above the walls, and — since ELM-4 — discarded slab tops while the camera looks straight
down. Every one of those substitutions assumes there is a single storey to substitute for. ELM-4's
two-storey fixture is the first model to break the assumption, and ELM-4's direction-keyed discard
only stopped the worst symptom.

The fragments API already holds the missing primitive: `model.getSpatialStructure()` returns the IFC
spatial tree with a `localId` per node, and `model.setVisible(localIds, visible)` hides items. The
writer already puts every element in exactly one storey's containment, so the tree is authoritative
and no new data needs carrying in the IFC or the JSON.

## Goals / Non-Goals

**Goals:**
- Show any subset of storeys, hidden through the IFC spatial structure.
- Make a multi-storey view an occlusive render of the model in its own colours.
- Keep the plan surrogate exactly where it is true: one shown storey, in the top view.
- Give every storey its own plan-versus-3D comparison.

**Non-Goals:**
- The checkbox UI. It is this change's primitive with a face on it, and gets its own change.
- A roof, sections, cut planes, or per-storey plan SVGs from `render` (already one per storey).
- Changing the 3D snapshots, which render the IFC's colours with every storey shown.

## Decisions

### Visibility comes from the IFC spatial tree, driven by a URL parameter for now

`?storeys=a,b` selects storey ids; the viewer walks the spatial tree, collects each selected storey
node's descendants' local ids, and hides everything else with `setVisible`. The room-label,
dimension and wall-top planes are built per storey already, so they hide with it. An unknown id falls
back to showing everything and says so in the status line, matching how `?view=` treats an unknown
view rather than failing the render.

Alternatives considered: matching elements by `Tag` against the building JSON (rejected — it
re-derives containment the IFC already states, and misses aggregates); a second model load per
storey (rejected — one fragments model keeps one material set, which plan style's `styleOf` depends
on).

### Plan style becomes a single-storey mode

With exactly one storey shown, plan style does what it does today, for that storey, at that storey's
elevation — which also gives an upper floor a plan surrogate for the first time. With several shown,
the viewer renders the IFC's own colours: occlusive, honest, and what the snapshots already produce.

Alternatives considered: stacking each storey's fills at its own elevation (rejected — the fills are
drawn without depth precisely because coplanar floors fight, and a stack of cream planes is not a
building); keeping plan style global and cutting everything above a chosen storey (rejected — that
is a section feature, and still not occlusive); per-storey materials so slab tops could be discarded
selectively (rejected — one shared `IfcSurfaceStyle` per element kind is what lets `styleOf`
recognise materials at all).

Consequence: the interactive default for a multi-storey model becomes the IFC colours. That is the
vision's "completely occlusive" default arriving for free, and the plan surrogate stays one
`?storeys=` — later one checkbox — away.

### The plan-versus-3D test compares each storey against itself

Each storey's plan is compared with the top view of that storey alone. This drops the constraint
that let ELM-4's fixture pass — both storeys sharing one wall layout — and covers upper floors,
whose plans have never been checked against anything.

### ELM-4's slab-top discard stays, scoped and unchanged

It remains keyed on looking straight down, inside single-storey plan mode. Nothing about it changes;
it simply stops being reachable in a multi-storey view, where there is no fill plane behind the slab
to justify it.

### Walk mode stands on the lowest shown storey

The entry pose already reads the lowest storey's elevation from the building JSON; it reads the
lowest *shown* one instead, so hiding the ground floor walks you on the first.

## Risks / Trade-offs

- **Hidden storeys' materials stay patched.** Plan style patches materials, not items, so a hidden
  storey's slab material still carries the discard shader. Harmless while hidden, and single-storey
  plan mode is the only place the discard is on.
- **Annotations must hide with their storey.** They are per-storey planes in `planLayers`; tying
  their visibility to the storey's is part of the work, not a given. Forgetting it shows a floating
  first-floor label over an empty ground floor.
- **The multi-storey top view loses the plan surrogate.** Deliberate: it shows the topmost slab, as a
  building should. Anyone wanting the drawing reaches for one storey.
- **`?style=plan` with several storeys silently renders IFC colours.** Documented in the spec and the
  docs; the alternative — erroring — would break saved URLs for no gain.
- **Fragments visibility is per item, and stairs aggregate.** A stair's flights and landing hang off
  the stair, which hangs off the storey; the spatial tree must be walked through aggregations, not
  just containment, or hidden storeys leave their stairs behind.

## Migration Plan

1. Parse and validate `?storeys=`, falling back to all storeys.
2. Hide unselected storeys through the spatial tree, including their annotations and plan layers.
3. Scope plan style to one shown storey; render IFC colours otherwise.
4. Point walk mode's entry pose at the lowest shown storey.
5. Re-point the plan-versus-3D test per storey and add the two-storey model's upper floor to it.
6. Update `docs/rendering.md` and run `npm test`, `npm run typecheck` and `npx openspec validate --all`.

The change is additive in the URL and subtractive in what plan style claims; no model, schema or IFC
change is involved.

## Open Questions

- The checkbox UI's shape, and whether hiding a storey should survive in the URL so a view can be
  shared: both belong to the follow-up change.
- Whether the occlusive multi-storey view should keep the charcoal wall tops as a nod to the plan.
  This change says no; it is cheap to revisit once it can be seen.
- Whether `render` should grow a per-storey snapshot set. Not needed while the plans cover that role.
