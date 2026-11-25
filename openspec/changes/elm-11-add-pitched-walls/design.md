# Design

## Context

See proposal.md — Why. A wall is written today (src/ifc/writer.ts) as a plan rectangle
(`length × thickness`) extruded straight up by `height`, so its top is always flat. The IFC writer
already extrudes a *side* profile across a width for stair flights: a profile in `(along, up)` swept
along the across axis. The plan render draws walls from their footprint only (it never reads wall
height), and the 3D view is meshed from the IFC, so the writer is the single place a sloping top has
to be built. The schema keeps structural rules in zod and cross-element rules in `src/checks/`.

## Goals / Non-Goals

**Goals:**
- Let a wall's top follow a roof line (gable end today) while flat walls stay exactly as they are.
- Reuse the existing side-profile extrusion rather than inventing new IFC machinery.
- Keep the schema small: one optional field on `Wall`, no new element type.

**Non-Goals:**
- A roof surface element, overhangs, tiles, hips or valleys as first-class geometry.
- Changing the plan render (footprint-based, height-independent).
- Settling the attic's measured heights or the extension's roof (provisional, flagged).

## Decisions

### A top-edge polyline, not a parametric gable or a roof element
`Wall` gains optional `profile`: an open polyline of `{ along, up }` points giving the top edge from
the wall's start (`along: 0`) to its end (`along: wallLength`), measured up from the storey elevation.
The body is the area under that edge, extruded across the thickness.

- *Over a parametric gable (`eaves`, `ridge`, `ridgeAlong`)*: the top edge is not always a symmetric
  pentagon — the attic gables run right down to the floor (`up: 0` at the eaves), and the first floor's
  extension walls taper from the full ceiling at the extension start. A polyline places any number of
  peaks and breaks wherever the roof line needs them, without encoding roof semantics in the schema.
  It reuses the point-array shape already used for outlines, so the schema surface stays small.
- *Over a full closed elevation polygon*: storing only the top edge (the base is implied at `up: 0`)
  avoids redundant base points and keeps the authoring simple; the writer closes the profile.
- *Over a roof element*: only wall tops are sloped; a roof surface is more than is asked for.

### `height` and `profile` are mutually exclusive
A wall has either a flat `height` or a `profile`, never both, so there is one source of truth for the
top. `height` becomes optional and a structural refine requires exactly one. Existing models keep
`height` and are unaffected. The alternative — keeping `height` as an eaves base alongside `profile`
— was rejected because it makes the top ambiguous and forces every reader to reconcile two fields.

### Structural vs cross-element validation
The schema validates the profile's shape: at least two points, `along` a non-negative integer strictly
increasing along the edge, `up` a non-negative integer (0 where the top edge meets the floor) with at
least one point above 0 so the wall has a body. That the edge spans the wall (`along` 0 →
`wallLength`) is a cross-element rule (length is derived from `start`/`end`), so it lives in
`src/checks/`, like the other opening-fit rules. `wallSideProfile` clips floor-touching stretches so a
gable running to 0 is a clean triangle, not a degenerate polygon.

### Extrusion orientation mirrors the stair flight
A pitched wall's body is its closed side profile — base `(0,0)→(L,0)`, up the end, back along the top
edge, down the start — extruded across the thickness, positioned by the justification's face offsets.
This is the stair flight's `(along, up)`-profile-swept-across pattern, with a placement whose across
axis is the extrusion direction. Flat walls keep the plan-rectangle-swept-up path unchanged.

### Effective height and opening fit under a slope
The profile's highest point is the wall's effective height. An opening fits only if its sill + height
is at or below the **lowest** point of the top edge across the opening's whole width, so a window near
a gable end's low eaves cannot poke through the slope. The round-trip expects the profile area ×
thickness minus the opening boxes (each still `width × thickness × height`), extending today's
`length × thickness × height` formula.

## Risks / Trade-offs

- [A sloping top makes opening fit position-dependent] → fit against the minimum top-edge height over
  the opening's width, with a check scenario for a window near the low eaves.
- [The profile could disagree with the wall length] → a cross-element check requires the edge to span
  0 → `wallLength`; the schema enforces strictly increasing `along`.
- [Provisional attic heights look right but are unmeasured] → flag them in `shared.ts` like the
  basement level, and revisit when measured; the schema capability does not depend on the numbers.
- [The extension's roof differs from the core's gable] → the attic extension is open at floor level;
  the first floor's extension walls taper from the full ceiling where the extension starts, continuing
  the attic's east pitch. The polyline takes the break between the flat core and the tapered extension.

## Open Questions

- The measured ridge height and its exact position over the core (provisional values are used
  meanwhile; they change only the attic model, not the specs or the approach).
- A top-view plan comparison for pitched-wall storeys, which the cut-poché plan-vs-3D check skips
  (tracked in tasks.md — Workflow follow-up).
- A pitched wall's plan symbols (door gaps, window symbols) when it carries an opening, and the reveal
  splay fit against a sloped top — neither is triggered by the current models (no opening on a pitched
  wall); revisit if one is added.
