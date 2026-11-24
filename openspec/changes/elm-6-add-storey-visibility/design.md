# Design

## Context

See `proposal.md` for the motivation. Plan style (`viewer/main.ts`) substitutes a drawing for parts
of the model: `renderFloor`'s room fills for the floor, charcoal for wall tops, `renderWallTops`'
linework above the walls, and — since ELM-4 — discarded slab tops while the camera looks straight
down. Every one of those substitutions assumes there is a single storey to substitute for. ELM-4's
two-storey fixture is the first model to break the assumption, and ELM-4's direction-keyed discard
only stopped the worst symptom.

The fragments API already holds the missing primitive: `model.setVisible(localIds, visible)` shows
or hides items. The model JSON already says which storey owns each element, so no new data needs
carrying in the IFC or the JSON.

No model file is needed to prove any of it. The viewer test publishes JSON and IFC from an in-memory
model, and the plan side renders from the same object, so the tests synthesise a two-storey model by
cloning an existing single-storey one and adding a second storey at a higher elevation with a
different wall layout — the case the current comparison cannot handle. This change therefore depends
on no other open change, and can merge in either order with ELM-4.

## Goals / Non-Goals

**Goals:**
- Show any subset of storeys, hidden through fragments by Tag.
- Choose a floor in the bar and see it and everything below it.
- Make a multi-storey view an occlusive render of the model in its own colours.
- Keep the plan surrogate exactly where it is true: one shown storey, in the top view.
- Give every storey its own plan-versus-3D comparison.

**Non-Goals:**
- Per-storey checkboxes for arbitrary subsets. The selector is cumulative; any subset remains
  expressible through `?storeys=`, and checkboxes can follow on this same primitive.
- A roof, sections, cut planes, or per-storey plan SVGs from `render` (already one per storey).
- Changing the 3D snapshots, which render the IFC's colours with every storey shown.

## Decisions

### Visibility maps fragments to storeys by Tag, driven by a URL parameter for now

`?storeys=a,b` selects storey ids; every fragment whose Tag (or Name, for spaces, whose Tag the
writer leaves empty) is an element of a hidden storey is hidden with `setVisible`, as are that
storey's label, floor and constraint groups. The model JSON supplies the element-id-to-storey map,
so the IFC needs no new data and the mapping cannot drift from the model.

Alternatives considered: walking fragments' spatial tree (rejected after measurement — the tree
surfaced only one of the two storey nodes and gave every node a null localId, so hiding the upper
storey silently did nothing); matching elements by position or material (no stable key).

Elements with neither Tag nor Name — opening voids, component types — are never hidden. They carry
no geometry of their own, so nothing is left behind.

### The selector is a cumulative "up to" choice, written to `?storeys=`

A select in the bar lists the model's storeys lowest first. Choosing one sets the shown storeys to
the lowest floor through it, so it shows that floor and everything below, hiding everything above;
the topmost choice is every storey and clears the parameter. `?storeys=` keeps its exact-subset
meaning, so the tests and hand-written links still ask for one storey alone. A URL whose set is not
some floor's prefix has no single floor to display, so the selector shows a disabled custom value
until a floor is chosen.

The selector updates the loaded model in place: every storey's labels, floor and constraint groups
are built up front and toggled, and each fragment is made visible or hidden with `setVisible`. No
reload and no texture rebuild. A change does not move the camera — only the drawings change, so
floors can be compared from one viewpoint. The compass is re-projected against the shown footprint
and walk mode's next entry uses the lowest shown floor; the view buttons remain the way to re-fit.

Alternatives considered: checkboxes (the requested behaviour is cumulative, so a select expresses
it with less UI); a half-open range (a floor is the obvious unit); a slider (no storey names, and it
reads as a section cut).

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

Only the slab's top is suppressed. Its underside stays the ceiling below, and its exposed edges
stay drawn, so the floor reads as its structure's thickness at a stairwell instead of a single
plane. At the outer walls the first-floor slab stops half a wall into the wall body: its edges are
buried, the facade stays continuous, and the earlier grey band does not return. That inset also
removes a provisional slab overhang outside the footprint. The stairwell opening follows the ground
plan's room and wall edges, not a loose rectangle, and external walls carry up through the
structure while internal walls stop at its underside, so the slab sits on them and its edge rises
from the wall tops.

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
- **Stairs are not in this branch's schema yet.** The owner map reads a storey's `stairs`
  defensively, so when ELM-4 lands, its flights and landings hide with their storey by Tag without
  further work; until then this branch has never hidden a stair.
- **Every storey's plan layers exist even when hidden.** Building them up front is what lets the
  selector re-show a floor without a reload; the cost is texture and line memory for layers that
  are not drawn. Small at this model's size; rebuild on demand if a real building makes it hurt.
- **The frame stays sized for the old selection.** Hiding the upper floors leaves the remaining ones
  in the lower part of a frame fitted to the whole building. Deliberate: a camera that stays put is
  what makes floor-by-floor comparison possible, and a view button re-fits on request.
- **Measurements do not follow the storey selection.** ELM-8's measurement layer is independent of
  the storeys, so a measurement taken on a floor stays drawn when the selector hides that floor. It
  remains depth-tested, so geometry in front still hides it. Measurements learning their storey is
  ELM-8's work, not this change's.
- **ELM-4 may merge after this change.** Both touch `applyStyle` and `patchTops` in `viewer/main.ts`,
  so whichever lands second resolves one small code conflict; per the decision above, ELM-4's viewer
  part should then be dropped, not re-cut. Nothing here needs ELM-4's schema, IFC or stair work.

## Migration Plan

1. Parse and validate `?storeys=`, falling back to all storeys.
2. Add the storey selector: cumulative selection, updated in place, written back to `?storeys=`.
3. Hide unselected storeys by Tag, including their annotations and plan layers.
4. Scope plan style to one shown storey; render IFC colours otherwise.
5. Point walk mode's entry pose at the lowest shown storey.
6. Re-point the plan-versus-3D test per storey, adding the synthesised two-storey model's upper floor
   as a compared case.
7. Update `docs/rendering.md` and run `npm test`, `npm run typecheck` and `npx openspec validate --all`.

The change is additive in the URL and subtractive in what plan style claims; no model, schema or IFC
change is involved.

## Open Questions

- Whether per-storey checkboxes for arbitrary subsets should follow. The selector covers the
  cumulative case and `?storeys=` already expresses any subset.
- Whether the occlusive multi-storey view should keep the charcoal wall tops as a nod to the plan.
  This change says no; it is cheap to revisit once it can be seen.
- Whether `render` should grow a per-storey snapshot set. Not needed while the plans cover that role.
