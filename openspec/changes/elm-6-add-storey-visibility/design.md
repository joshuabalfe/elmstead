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

No model file is needed to prove any of it. The viewer test publishes JSON and IFC from an in-memory
model, and the plan side renders from the same object, so the tests synthesise a two-storey model by
cloning an existing single-storey one and adding a second storey at a higher elevation with a
different wall layout — the case the current comparison cannot handle. This change therefore depends
on no other open change, and can merge in either order with ELM-4.

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

### Each shown storey's floor is its own occlusive fill plane

Plan style keeps substituting the plan's room fills for the floor, but now for every shown storey,
at that storey's own level, and writing depth. The floor you see from above is the topmost shown
storey's, and it hides everything below — which is what "completely occlusive" means for a stacked
building, in the plan's own palette. Slab tops stay discarded in plan style at every storey, so the
fills are the floor rather than a grey plane over them; in `?style=ifc` nothing is substituted and
the slabs are simply solid.

This reverses an earlier rejection of stacked fills. They were drawn without depth because coplanar
floors fight; writing depth is what makes a stack of them a building instead of a see-through pile.
The fills are cut out with `alphaTest` rather than blended, so they stay in the opaque pass and occlude
like geometry.

Alternatives considered: rendering multi-storey views in the IFC's colours with no fills (rejected on
review — the grey slab reads as a missing floor; the cream rooms are what make a storey legible);
cutting everything above a chosen storey (a section feature, and still not occlusive); per-storey
materials so slab tops could be discarded selectively (one shared `IfcSurfaceStyle` per element kind
is what lets `styleOf` recognise materials at all).

### Room names lie on the ceiling plane, not on billboards

Names and areas were camera-facing sprites with `depthTest: false`, so they painted over whatever
was above them — a ground floor's labels read through the first floor. They join the dimensions on
the plane at each storey's ceiling instead, which occludes like everything else. The cost is that
from a low angle they foreshorten, as the dimensions already do; in walk mode they read from below
as ceiling text, mirrored, exactly like the dimensions.

### The plan-versus-3D test compares each storey against itself

Each storey's plan is compared with the top view of that storey alone. This drops the constraint
that let ELM-4's fixture pass — both storeys sharing one wall layout — and covers upper floors,
whose plans have never been checked against anything.

The comparison also crops the plan to its drawing area: the sheet furniture (title, north arrow,
scale bar) is ink whose antialiasing passes through the wall grey, and a long run of it inflates the
wall box the comparator aligns on. And it skips pixels within two pixels of a classification boundary
in either image, since the two rasters are at different scales and their edges fall a pixel apart.

One case is skipped, labelled in the test: elmstead's ground storey, whose 450 mm west wall carries
the front door's gap and swing and registers a half-metre band of mismatch against the top view at
the top view's scale. Every other storey and model compares clean; root-causing that band is a task
below, not a reason to hold the change.

### ELM-4's slab-top discard is superseded

ELM-4 keyed the discard on looking straight down, to stop an orbit revealing a hole through an upper
slab. With occlusive fills there is no hole to reveal: the discard returns to being unconditional in
plan style, and ELM-4's direction keying becomes unnecessary once this change lands. If ELM-4 merges
after this one, its viewer change and its ifc-viewer delta should be dropped rather than re-cut.

### Walk mode stands on the lowest shown storey

The entry pose already reads the lowest storey's elevation from the building JSON; it reads the
lowest *shown* one instead, and centres on the shown storeys' footprint, so hiding the ground floor
walks you on the first.

## Risks / Trade-offs

- **Hidden storeys' materials stay patched.** Plan style patches materials, not items, so a hidden
  storey's slab material still carries the discard shader. Harmless while hidden.
- **Annotations and fills must hide with their storey.** They are per-storey groups now; tying their
  visibility to the storey's is part of the work, not a given. Forgetting it shows a floating
  first-floor label over an empty ground floor.
- **Fragments visibility is per item, and stairs aggregate.** A stair's flights and landing hang off
  the stair, which hangs off the storey; the spatial tree must be walked through aggregations, not
  just containment, or hidden storeys leave their stairs behind.
- **Framing still fits the whole model.** `setView` frames `model.box`, which covers hidden storeys
  too, so a single storey of a tall building sits small in frame until the box follows visibility.
  Left as is: it is a framing nicety, not a correctness issue.
- **ELM-4 may merge after this change.** Both touch `applyStyle` and `patchTops` in `viewer/main.ts`,
  so whichever lands second resolves one small code conflict; per the decision above, ELM-4's viewer
  part should then be dropped, not re-cut. Nothing here needs ELM-4's schema, IFC or stair work.

## Migration Plan

1. Parse and validate `?storeys=`, falling back to all storeys.
2. Hide unselected storeys through the spatial tree, including their annotations and plan layers.
3. Scope plan style to one shown storey; render IFC colours otherwise.
4. Point walk mode's entry pose at the lowest shown storey.
5. Re-point the plan-versus-3D test per storey, adding the synthesised two-storey model's upper floor
   as a compared case.
6. Update `docs/rendering.md` and run `npm test`, `npm run typecheck` and `npx openspec validate --all`.

The change is additive in the URL and subtractive in what plan style claims; no model, schema or IFC
change is involved.

## Open Questions

- The checkbox UI's shape, and whether hiding a storey should survive in the URL so a view can be
  shared: both belong to the follow-up change.
- Whether the occlusive multi-storey view should keep the charcoal wall tops as a nod to the plan.
  This change says no; it is cheap to revisit once it can be seen.
- Whether `render` should grow a per-storey snapshot set. Not needed while the plans cover that role.
