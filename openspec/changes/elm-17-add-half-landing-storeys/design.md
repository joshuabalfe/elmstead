# Design

## Context

A stair climbs from its storey to the next one up (`model-checks`: the target may not skip a
storey), and a wall always stands on its storey's floor: the schema has no wall base offset. A
half landing modelled as a landing segment is therefore a platform nothing can stand on. A
split-level extension, whose floors are the half landings, has no level for its walls and windows.
See proposal.md for the elmstead case.

## Goals / Non-Goals

**Goals:**
- A half landing that carries walls and openings, with no schema or pipeline change.
- Equal (or near-equal) risers either side of the landing, derived from the storeys as today.

**Non-Goals:**
- Drawing walls from other storeys on a storey's plan. A half-landing plan shows only that storey's
  own walls; walls of the floors either side that cross its cut height do not appear.
- Headroom checks, which are still not modelled.
- The basement half landing and the rear-hall steps in elmstead, which are a separate plan.

## Decisions

**A storey per half landing, not a wall base offset.** A wall base offset would let a wall on the
floor below start at the landing's level, but it is a schema change and still leaves openings and
plans tied to the main floors. A storey gives the landing its own plan, viewer stop, walls and
openings with the existing types. This follows the external storey (ELM-10), which made a non-floor
storey a stated pattern.
*Alternative considered:* drawing other storeys' walls that cross a storey's cut height on its plan
(a renderer change). It fixes the half-landing plans' look but not where split-level walls stand,
and the owner confirmed the extension really is split level.

**The stair splits at the landing storey.** The no-skip check forces it: a stair from the ground
floor cannot climb past a storey at 1641 mm. Each part is an ordinary stair whose last flight ends
on its target storey, and the landing is that storey's slab. The IFC therefore has two straight
stairs and a slab where it had one `HALF_TURN_STAIR`, a small loss of meaning accepted for walls
and openings that can stand at the landing's level.

**The landing's elevation is the lower flight's share of the rise.** For `lower + upper` risers
between floors at `b` and `t`, the landing is at `b + round((t − b) × lower / (lower + upper))`.
A storey elevation is a whole millimetre, so the two flights' risers can differ by a fraction of a
millimetre (about 0.05 mm on elmstead's 9 + 8). Storing it as a derived value in the model keeps it
following the floors when they are measured.

**Split-level walls stack on the half-landing storeys.** Each half-landing storey's extension walls
rise to the next half landing (or the roof), and the floor below keeps only the part below the
first landing. The first floor's slab bands that closed the gap between the ground and first-floor
extension walls go, because those walls are now continuous.

**The comparison skips storeys whose walls span less than 2 m.** The comparator finds the wall box
by counting rows and columns with at least 120 wall pixels in the plan (600 mm at 5 mm per px) and
80 in the top view. Across a 1.4 m extension, a column crosses only the north and south walls
(about 525 mm), so the plan's box collapses to the east wall. Lowering the thresholds risks
antialiased text and stair lines counting as wall on every other storey. A 2 m span on the walls'
start and end points is a simple, model-independent rule that keeps every full floor in.

## Risks / Trade-offs

- [Half-landing plans omit the core walls of the floors either side] → The plans show the landing,
  its stairs and its own walls. Drawing cut walls from other storeys is a possible follow-up if the
  plans need it.
- [The comparison no longer covers half-landing storeys] → Their walls are covered by the
  model's own geometry tests (`tests/elmstead.test.ts`), and the top view was checked by eye.
- [More storeys to step through in the viewer] → Accepted: each half landing is a real level with
  its own walls.

## Migration Plan

None needed outside elmstead: existing models keep their landing segments, and nothing in `src/`
changes.
