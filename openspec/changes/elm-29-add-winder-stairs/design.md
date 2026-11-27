# Design

## Context

A stair is an ordered list of segments, flights and landings. Every level is derived: the rise
comes from the two storeys, the riser height from the total riser count, and a flight's going from
its plan run (`src/shared/geometry/stair.ts`). The IFC writer, the round-trip, the plan, the checks
and the viewer's bounds each walk the segments. See proposal.md for why a winder cannot be said with
a flight or a landing.

A winder is a quarter-turn (or other) fan of treads around a newel post, usually in the corner of
a stairwell. Each tread is a wedge, wide at the outer wall and narrow at the pivot, and the risers
between them are fan lines from the pivot to the outer walls.

## Goals / Non-Goals

**Goals:**

- Say a winder at the start of a stair, followed by a straight flight, in the schema, the IFC, the
  plan and the viewer, with the three renderings agreeing.
- Leave every existing model's output unchanged.

**Non-Goals:**

- A winder after a landing or a flight, at the top of a stair, or two winders in a row. The schema
  and geometry do not forbid them; the checks do, until a model needs them (see Decision 3).
- Curved, spiral or helical stairs, and winders with unequal fan angles.
- A soffit under the winder, headroom, or a hole in the upper floor's slab. The model shapes the
  upper slab's outline around the stairwell, as it does for flights.

## Decisions

### 1. A new segment kind, `winder`, not a variant of a flight or a landing

The treatment sheet in `.agents/skills/add-support-for-new-element-types` asks first whether an
existing type can say it.

- **A flight** has parallel nosings across a rectangle. A fan has none of that, and an optional
  `taper` field would turn a flight into two different shapes under one name.
- **A landing** is flat, so winder treads would have no risers or treads in the IFC, the plan or
  the viewer, and the riser count would be wrong.
- **Several short flights** do not meet at a pivot, and each would need its own start, end and width.
- **A field on a flight or landing** is the other option the skill lists, and for the same reasons
  it would carry the same two shapes.

A winder is a new member of the existing `StairSegment` union, so a stair still holds `segments`,
and the revision and diff code, which handle a stair whole, need no change.

### 2. Shape

```ts
{
  kind: ("winder", id, outline, pivot, entry, risers);
}
```

- `outline` is the winder's plan block, a convex polygon of at least three points.
- `pivot` is the newel: one of the outline's points. The treads fan out from it.
- `entry` is the outline point next to the pivot where the walker steps on. The other point next to
  the pivot is the exit. The fan turns through the outline's interior angle at the pivot, which is
  90° for a square corner.
- `risers` is an integer of at least 2 and is also the number of treads (see Decision 3).

Points rather than indices, like every other point in the model, and the pivot and entry are checked
against the outline (not enforced by the schema) so a mismatch is an ERROR with a message. An
outline of integer millimetre points gives an angle that is only approximately 90°; the IFC type
uses a 1° tolerance (Decision 6).

Nothing else is stored: not the fan lines, tread polygons, levels or heights.

### 3. Levels: a winder owns its entry and interior risers, and a flight owns its start edge

A flight with R risers has riser lines at 0, going, …, (R−1)·going, R−1 treads between them, and its
top is R risers up. Its last riser sits at its end edge and rises to whatever follows.

A winder with N risers has N treads and N riser lines: its entry edge and its N−1 fan lines. Tread
k is at k risers above the winder's base, so the winder's top is N risers up: the level of its
last tread. The riser from that tread up to the first tread of the flight is the flight's own first
riser, at the flight's start edge, which sits on the winder's exit edge. So every riser line has one
owner. The totals are:

```text
total risers = flights' risers + winders' risers (+ 1 if a top landing ends the stair)
```

This is why a winder is allowed only as the first segment, followed by a flight:

- **After a flight** the flight's last riser and the winder's entry riser would be the same line,
  owned twice.
- **After a landing** works by this rule, but the check that the landing meets the winder's entry
  edge is more code, and no model needs it yet.
- **Last in the stair** leaves the riser onto the storey above, or onto a top landing, with no owner.

Relaxing either is a follow-up change; this one's checks enforce the restriction and the geometry
does not depend on it.

### 4. Tread geometry: fan lines at equal angles from the pivot

The fan lines divide the angle between the entry and exit edges into N equal parts. Each line runs
from the pivot to where it first meets the outline boundary, which for a convex outline is one
point on an edge not touching the pivot. Tread k is the polygon of the pivot, the point where fan
line k−1 ends, any outline points between that and the end of fan line k (the outline's far corner
for a square), and the end of fan line k. The entry and exit edges are fan lines 0 and N.

Equal angles are what a drawn plan shows and need no design input from the user. A winder with
unequal fan angles, or a fixed walking-line tread depth, is a different shape that this schema does
not say; it is a non-goal.

The treads partition the outline exactly, which the checks and the round-trip rely on.

### 5. IFC: an `IfcStairFlight` of type `WINDER`, one solid per tread

- A winder is an `IfcStairFlight` aggregated under the stair's `IfcStair`, like a flight, with
  `PredefinedType` `WINDER`, `NumberOfRisers` N, `NumberOfTreads` N and the stair's riser height.
  `TreadLength` is omitted, because wedge treads have no single length.
- The body is one `IfcExtrudedAreaSolid` per tread: the tread's polygon extruded from the winder's
  base to tread k's level. That is a solid mass under the winders rather than the hollow waist a
  flight has. A soffit under a fan needs a swept or boolean shape, and the round-trip's
  area-times-height volume check is exact for prisms. Trade-off: the winder is heavier than the real
  one, and the headroom beneath is not modelled either, as for a flight.
- `IfcStair.PredefinedType` is `QUARTER_WINDING_STAIR` when the stair starts with a winder turning
  through 90° within 1°, and `NOTDEFINED` otherwise. The existing flight-turn rule is unchanged.

### 6. Checks

Segment order (winder first, then a flight), the outline (three distinct points, convex, not
self-intersecting, like landings), the pivot and entry (outline points, adjacent), and the next
flight's start on the exit edge within 1 mm, as the landing check measures a flight meeting a
landing. A winder id joins the unique-id kinds.

### 7. Plan

A winder draws as a `stair-winder` group: its outline, a tread line on each interior fan line and a
walking arrow. The arrow is a polyline from the entry edge's middle through the middle of each fan
line to the exit edge's middle, ending in the same arrowhead as a flight. Stair colours are reused
and stairs stay the last geometry layer, so the plan-versus-3D comparison ignores them as it ignores
flights. The plan's extent includes the winder outline.

### 8. Viewer

A winder is an IFC stair solid in the stair colour, so the viewer's readability recolour applies by
colour, and storey ownership already maps every segment id to its storey. The banding shader bands
on world height with one riser height per model, so winder treads band like flight treads. That
riser height is computed in the viewer by dividing the rise by the sum of the **flights'** risers
(`src/frontend/scene/engine.ts`), which for a stair with a winder would give bands too tall. It must
count winders' risers as the schema's levels do, and the check for it is looking at the viewer, as
the add-support skill requires.

### 9. No new colour, revision change or diff change

No new IFC colour, plan colour or storey collection. A winder lives inside a stair, and a stair is
replaced and diffed whole. `COMPARED` and the revision `SCHEMAS` already name the stair.

## Risks / Trade-offs

- **Right-angle winders only in the IFC type.** A winder that is not 90° (within 1°) is
  `NOTDEFINED`. → Stated in the spec; add types when a model needs them.
- **Equal-angle fan.** Real winders are often set out with equal walking-line steps, and the
  difference is small but visible. → The schema stores no fan angles, so a later field can add them
  without breaking models.
- **Solid under the treads.** Heavier than a real winder, and hides nothing the plan shows. →
  Matches the volume check; a soffit is a follow-up if headroom is ever modelled.
- **Winder-first only.** A model with a winder elsewhere cannot be built. → An ERROR names the
  rule rather than producing a stair with an unowned or double-owned riser.
- **Traced pivot or entry misplaced by a few mm.** → The outline check is an exact vertex match, so
  authors derive the pivot and entry from the outline's own points in the model, as walls derive
  from shared dimensions.

## Migration Plan

Additive. A stair with flights and landings produces the same JSON, IFC and plan as before, which
the existing SVG snapshot and the IFC tests confirm. `npm run schema` regenerates the JSON Schema.
Rollback is reverting the change; no model uses a winder until the `williamson` model is added.

## Open Questions

- Should a later change relax Decision 3 for a winder after a landing, or at the top of a stair?
  It does not change this change's specs or tasks.
