# Design

## Context

See `proposal.md` for motivation. The schema currently has walls, openings, slabs and rooms on a
storey; the checks layer now has a `checkModel` aggregator from ELM-1. `models/elmstead/` reserves a
half-turn stair in its ground-floor plan but has no upper storey yet, so this change adds the
pipeline capability and exercises it with a two-storey fixture rather than inventing an upper floor
for Elmstead.

## Goals / Non-Goals

**Goals:**
- Add first-class stairs with one source of truth for vertical geometry.
- Map stairs, flights and landings faithfully to IFC4.
- Draw and check stairs with the same determinism as the rest of the pipeline.
- Keep the schema additive so existing models remain valid.
- Provide a two-storey fixture that exercises a half-turn stair end to end.

**Non-Goals:**
- Winders, curved or spiral stairs, railings, front steps, or upper-floor slab openings.
- Headroom, building-code or collision checks.
- The Elmstead first-floor layout or its stair dimensions.
- Drawing an arriving stair on the destination storey's plan.
- Viewer work for stairs. The viewer renders the stair's IFC geometry as it is, and its plan-style
  overlay is unchanged because stairs are drawn only in `renderPlan`. The one viewer fix here is not
  about stairs: it is the plan-style slab-top bug the first two-storey model exposed.

## Decisions

### The stair is a storey element anchored at its lower storey

`Storey` gains an optional `stairs` array. A stair names the storey it climbs to with `toStoreyId`;
its bottom is the containing storey's elevation. This keeps the spatial model consistent, gives the
IFC writer one `IfcBuildingStorey` to contain the stair in, and makes the rise derivable.

Alternatives considered: model-level `stairs` (rejected because every other element is storey-level
and the writer would still have to choose a containing storey); an explicit `topElevation` with no
target storey (rejected because it duplicates the floor level and can drift); separate storey-level
`StairFlight` and `StairLanding` elements (rejected because it adds more top-level types without a
stair container).

Consequence: a stair can only be added when its destination storey exists, and the checks require
that destination to be the next storey up rather than any higher one. The fixture supplies that;
Elmstead's stair waits for its first floor to be traced.

### Ordered segments carry the stair's sequence

A stair is an ordered `segments` array of flights and landings, discriminated by `kind`. A flight
carries start, end, width and riser count. A landing carries an outline and thickness. The order
tells the writer and renderer which landing follows which flight, so landing heights are
unambiguous.

Alternatives considered: separate `flights` and `landings` arrays with implicit pairing (rejected
because the pairing is ambiguous); a parametric half-turn archetype (rejected because it cannot
express irregular landings and would bake one stair type into the schema); reusing `Slab` for
landings (rejected because a landing's height is derived from the flight sequence, and a storey
slab would duplicate it).

### Elevations, riser height and going are derived

The derivation is:

```text
total rise = toStorey.elevation - storey.elevation
riser      = total rise / sum(flight.risers)
going      = flight plan run / (flight.risers - 1)
levels     = walk the segments: a flight raises by risers * riser, a landing stays level
```

Authored lengths stay integer millimetres; derived values such as `riser` and `going` may be
fractional. IFC accepts real lengths, the SVG writer rounds to one decimal, and tests use a
tolerance. Storing these values instead would create two sources of truth and let a stair drift
away from its storeys.

Derived values are therefore plain `number` millimetres, not the branded `Mm` the authoring helpers
use. `Mm` is an integer brand, so the units module fights this derivation: `mm(190.625)` and
`div(mm(3050), 16)` both throw, and `divRound(mm(3050), 16)` returns 191, which sixteen risers turn
into 3056 mm — six millimetres past the target storey, and no check would notice because the
building-code limits are out of scope. The stair geometry helper divides plainly and returns
`number`; the writer's `len` and `posLen` already take a plain number, so nothing converts on the way
out.

### Flight geometry is one stepped profile extruded across the width

Each flight body is a single closed profile in the vertical plane along the run: a stepped top,
with the mass continuing down to the flight's base, extruded horizontally across the flight width.
One solid gives an exact volume and avoids overlapping step boxes. The writer needs a small helper
for a profile extruded horizontally; the profile area is shared with the round-trip check.

A sloped soffit or waist is more realistic and can replace the solid-to-base profile later without
changing the schema or IFC entity choices.

### IFC mapping separates the container from its parts

- `IfcStair` is contained in the lower storey. Its `PredefinedType` comes from the turning angle
  between consecutive flights' plan directions: one flight `STRAIGHT_RUN_STAIR`; two flights at 0°
  `TWO_STRAIGHT_RUN_STAIR`; 90° `QUARTER_TURN_STAIR`; 180° `HALF_TURN_STAIR`; otherwise `NOTDEFINED`.
- Each flight is an `IfcStairFlight` with `NumberOfRisers`, `NumberOfTreads` (risers minus one),
  `RiserHeight`, `TreadLength` and a stepped body.

Both attribute names are the IFC4 ones, checked against IfcOpenShell 0.9.0.post1's IFC4 declaration:
`IfcStair` has no `ShapeType` and `IfcStairFlight` has no `NumberOfRiser` — those are the IFC2x3
names, and IFC4 rejects both. `IfcStairFlight` also has no `ShapeType` in IFC4; its `PredefinedType`
is `STRAIGHT`, since winders and curved flights are out of scope. The stair enum values themselves
are unchanged between the two releases.
- Each landing is an `IfcSlab` with `PredefinedType` `LANDING` and a body extruded down by its
  thickness.
- Flights and landings are aggregated under the stair with one `IfcRelAggregates` keyed
  `<stair-id>#aggregates`. They are not separately contained in the storey.
- The `IfcStair` has no body, so geometry is counted once through its parts. This requires the
  round-trip to exempt container elements from its "expected body" rule.

Alternatives considered: a single `IfcStair` with one body (rejected because it loses flight and
riser semantics downstream); containing each flight and landing directly in the storey without
aggregation (rejected because it loses the stair decomposition and duplicates containment).

### Plans draw the stair diagrammatically

The plan draws each stair in full on its containing storey: flight footprints, tread lines at each
going, landing outlines and a walking-direction arrow on each flight. Stair points join the
drawing extent. Groups use `class="stair"`, `stair-flight` and `stair-landing` with `data-id`.

Nothing needs exempting from the plan cut: `CUT_HEIGHT` only decides which openings are cut, and no
geometry is cut at all, so a half landing at 1525 mm is drawn like everything else. A break line and
a destination-storey down arrow can be added later.

Stairs are drawn by `renderPlan` alone. `renderFloor`, `renderWallTops` and `renderPlanAnnotations`
are also imported by `viewer/main.ts`, which composites them into the viewer's plan-style overlay,
so putting stair line work in one of them would silently change the viewer and the top view the
plan-vs-3D test reads back. Drawing them only in `renderPlan` keeps the overlay as it is and leaves
the viewer to show stairs as their own IFC solids — so "no viewer changes" means no viewer code
changes and no change to what the overlay draws.

The plan-vs-3D test classifies only wall, room and paper pixels, skipping a pixel when either side
is something else. Two colour constraints follow:

- **Plan side.** Stair lines must not be `C.wall`, `C.room` or `C.paper`, or plan stair pixels become
  comparable against 3D pixels that show IFC-coloured solids. They must not be `C.wall` in
  particular: `wallBox` aligns the two images on runs of wall-coloured pixels, and a flight
  footprint is easily a 1200 mm run.
- **IFC side.** The stair colour must be at least 0.02 away in RGB distance from every entry in
  `STYLES`, not just visually distinct. `viewer/main.ts` nearest-matches each material against
  `STYLES` and patches what it recognises: a stair matched as `wall` gets its upward faces painted
  the plan's charcoal, and one matched as `slab` has its upward faces discarded, which would leave
  the stair invisible from above. An unrecognised stair material is left alone, which is what we
  want.

### Plan style discards slab tops only in the Top view

Plan colouring patches every material it recognises as a slab so its upward-facing fragments are
discarded, letting the plan's own room fills — drawn once, for the lowest storey only — stand in for
the floor. That is what makes the Top view read like the drawing, and the plan-versus-3D test
depends on it.

With one storey it is invisible. With two, every slab top goes, including the first floor's, and
nothing is drawn behind it: from above or from a corner you look straight through the upper floor to
the ground floor's cream fills. Walk mode hid the bug because it views slabs from underneath, where
the normal points down and the patch leaves it alone.

The fix keys the discard on the camera direction rather than the storey: straight down, within a
couple of degrees, discards; anything tilted does not. Keying on the projection would not have
worked — orbiting out of the Top view keeps the orthographic projection, and that orbit is exactly
where the hole shows. A shared shader uniform flips it, so no per-storey materials are needed, which
the single shared `IfcSurfaceStyle` per element kind would otherwise force. The Top view — and so
the plan-versus-3D test — behaves exactly as before. Measured on the fixture from directly above:
401,756 room-fill pixels seen through the first floor before the fix, 0 after.

Residue, stated plainly: a perspective camera pointed straight down (`?camera=`) also reads like the
plan, and orbiting back to exactly vertical re-opens the see-through. Both are the same rule doing
its job; neither is a pose anyone holds by accident.

### Checks join the existing model-checks layer

`checkStairs` validates the target storey, segment alternation, flight run, landing outlines and
landing adjacency. Checks report against the stair or landing id and never write.

The target must be the *next* storey up, not merely a higher one. Nothing else bounds the riser
height — the building-code limits are out of scope — so a stair from the ground to a second storey
would silently derive 381 mm risers over 16 of them and pass every check. Requiring adjacency makes
the rise one storey's rise by construction.

Landing outlines join `checkOutlines`, which currently walks rooms and slabs only. A landing outline
is the same kind of open polygon and feeds both an IFC extrusion and the boundary test below, so a
self-intersecting one has to be caught there rather than surfacing as a bogus volume.

Landing adjacency is geometric, and `risers >= 2` stays in the schema: it is a property of one
flight, not a cross-element rule, so the checks do not repeat it and the check could never fire.

Stair, flight and landing ids join the model-wide id table — three more entries in `idEntries`, no
new rule — so this change modifies *Unique ids across the model* rather than adding a parallel
requirement. The same goes for landing outlines, which modify *Outlines are simple polygons*.

Deferred checks: headroom, stairwell fit, collision with walls and rooms, building-code limits, and
the upper-floor slab opening.

### The schema change is additive

`stairs` is optional and `schemaVersion` stays 1. Existing models remain valid and their generated
JSON is unchanged. A required `stairs: []` field would cause churn for no benefit; a version bump
would imply an incompatibility that does not exist.

## Risks / Trade-offs

- **The stair requires a destination storey** → Use a two-storey fixture now; add Elmstead's stair
  when its first-floor plan is traced. Changing the target elevation automatically updates the
  stair.
- **Derived riser and going are fractional** → Keep authored lengths integer; carry derived lengths
  as plain `number` millimetres, never through `mm()`, `div()` or `divRound()`; write them as IFC
  reals; round SVG output to one decimal; compare volumes with tolerance.
- **Solid-to-base flights look heavy** → Acceptable for a massing model; replace with a sloped
  soffit later without changing the JSON contract or IFC entities. Walk mode makes this more
  visible than the snapshots did: the camera passes through the stairwell at 1.6 m, so it spends
  time inside the flight mass, and what that looks like depends on back-face culling of the
  extrusion. Check it in the browser before accepting the fixture's stair.
- **`IfcStair` has no body** → The round-trip explicitly exempts container elements; tests cover
  both the container and its parts.
- **IFC decomposition validity** → IfcOpenShell validation runs on the fixture; web-ifc supports
  `IfcStair`, `IfcStairFlight` and `IfcSlab` with `LANDING`. The attribute names were checked against
  IfcOpenShell 0.9.0.post1's IFC4 declaration, where the IFC2x3 spellings `ShapeType` on `IfcStair`
  and `NumberOfRiser` are both out of bounds.
- **Plan-vs-3D colour classification** → Two constraints, both tested. The plan's stair colours stay
  off `C.wall`, `C.room` and `C.paper`, so stair pixels are skipped rather than compared, and off
  `C.wall` above all because `wallBox` aligns the images on runs of wall-coloured pixels. The IFC
  stair colour stays at least 0.02 in RGB distance from every `STYLES` entry, so the viewer's
  `styleOf` leaves the material alone instead of painting its tops charcoal or discarding them.
- **The target storey must be the next one up** → A stair that legitimately skips a storey would be
  rejected. Accept that: nothing else bounds the riser height while building-code checks are out of
  scope, and a skipped storey is far more likely to be a modelling mistake than an intent.
- **Walk mode passes through the stair** → ELM-3's walk mode snaps the camera to a fixed eye height
  with no geometry query, so a stair is scenery, not a route: you walk through the flight massing
  rather than up it. At the 1.6 m entry height the half landing at 1525 mm sits just below the
  eyeline, which reads well; the 5 cm near plane lets treads be inspected close up. Climbing would
  need floor-following, which modifies ELM-3's fixed-height and no-blocking rules and needs the
  stairwell void first, so it is a separate change.
- **Landing adjacency is geometric** → Check with a 1 mm tolerance; authored points are integer
  millimetres and derived points are exact until SVG rounding.
- **Upper-floor slab void is not modelled** → Out of scope; the first-floor plan and slab openings
  come with the upper-floor change.
- **Front steps, winders and railings do not fit this model** → Separate changes; do not approximate
  them with `Stair`.

## Migration Plan

1. Add the schema types and the optional storey field; regenerate the JSON Schema.
2. Add authoring helpers and geometry derivation.
3. Write the IFC entities, aggregation and stepped flight profile.
4. Extend the round-trip volumes and exempt the stair container.
5. Draw stairs in plans and include them in the extent.
6. Add `checkStairs` and register it in `checkModel`.
7. Add the two-storey fixture and tests, then update the docs.
8. Run `npm test`, `npm run typecheck` and regenerate generated files.

The change is additive; no data migration is required. Removing the change leaves existing models
untouched.

## Open Questions

- The Elmstead flight lengths, landing depth, riser split and first-floor finished level are
  deferred until its first-floor plan is traced; they do not change the schema or the approach.
- Whether to draw the arriving stair on the destination storey plan, with a down arrow, is deferred
  until that storey exists.
- The flight underside profile can be refined from a solid-to-base mass to a sloped soffit without
  changing the schema or IFC entity choice.