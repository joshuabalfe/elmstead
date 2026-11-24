# Design

## Context

See proposal.md - Why. The pipeline already permits most of the external-storey geometry: storey
elevations are unbounded integers (negative is legal), a storey's `walls`/`openings`/`rooms` arrays
may be empty, `checkStairs` only requires the target to be the next storey up, and the plan already
includes stairs that lie outside every room and slab outline. So a below-grade storey with a stair
to the ground floor validates and draws today. The new work is (a) stating the external-storey
intent in the spec and (b) rendering external ground, which needs one optional presentation field on
`Slab`. Presentation is a fixed type-keyed palette (`src/ifc/styles.ts`, `src/render/style.ts`); the
viewer nearest-matches IFC materials against `STYLES` (`styleOf` in `viewer/main.ts`) and, in plan
style, replaces slab tops with the plan's floor fills.

## Goals / Non-Goals

**Goals:**
- Express front steps and external ground with no new element type and one optional schema field.
- Keep existing models byte-identical (IFC and snapshots) unless they opt into `material: "ground"`.
- Keep the plan-versus-3D comparison and snapshot framing stable.

**Non-Goals:**
- Sloped ground / garden terrain and pitched roofs (later changes; a future sloped-surface mechanism
  can reuse this storey).
- A general material system; the enum is just `concrete` and `ground` for now.
- Modelling the hill beyond the local level at the steps' foot.

## Decisions

**Street as a below-grade storey, reusing `Storey`/`Stair`/`Slab`.** A real level holding external
works (ground slab, front steps) is a recognised BIM convention and needs no schema change.
Alternatives rejected: a new `Terrain`/`ExternalSteps` element type (heavier IFC mapping and
round-trip, against "keep the schema small"); an empty fake storey (a phantom level in the selector,
plans and IFC); `IfcSite` terrain representation (our pipeline is storey-based). Consequences we
accept: an extra entry in the storey selector, an extra plan sheet that doubles as a site plan, an
extra `IfcBuildingStorey`, and walk mode starting at street level (it already stands on the lowest
storey).

**Front steps are an ordinary `Stair` on the street storey climbing to the ground storey.** Its rise
is derived from the two elevations, exactly like the internal stair; no change to the stair shape or
the derived-elevation invariant. An explicit-rise stair was rejected because it would break that
invariant.

**Optional `Slab.material` enum (`concrete` | `ground`), default `concrete`.** The smallest schema
addition that lets ground render differently; the default keeps every existing slab unchanged.
Alternatives rejected: a new `Ground` element type (heavier); inferring ground from its storey (a
hidden convention); a freeform material string (over-general for one need). The enum can grow later.

**Ground presentation through the existing palette path.** Add a `ground` entry to `STYLES` and the
plan palette; the writer colours a slab by its material; the viewer's `styleOf` recognises ground
and treats its tops like a slab's (discarded in plan style, coloured in 3D); both `renderPlan` and
the viewer's `renderFloor` floor overlay fill a ground slab with the ground colour. Two distinct
colour contracts apply: `styleOf` nearest-matches `STYLES` within 0.02 RGB, so the ground entry must
be at least 0.02 from every other entry; the plan-versus-3D comparison classifies against the plan's
`C` palette with a ±5-per-channel tolerance and only knows wall, room and paper, so the ground
colour must independently clear `C.wall`, `C.room` and `C.paper` to be skipped (like the stair
colour). Alternative — making ground a compared class — would force plan/3D pixel agreement and
churn the comparison; excluding it is simpler and consistent with stairs.

**One shared stair riser, accepted for now.** The viewer bands every stair on a single riser taken
from the stair with the largest riser (`viewer/main.ts`). Splitting it per stair needs either per-stair IFC
style variants or rendering the stairs outside Fragments, because Fragments merges all stair solids
onto one material and a shader holds one uniform. We keep the shared riser and relax the
`ifc-viewer` requirement to match, rather than take on that machinery for a shading detail; the
front steps' 150 mm risers still alternate against the main stair's 182.35 mm. If the treads read
poorly once the measured steps exist, revisit with per-stair materials. Alternative: per-stair
banding — deferred, not rejected.

**Modest ground extent, outside the footprint.** The ground slab reaches a few metres beyond the
building, not across the whole site, and stops at the outer walls: a basement may occupy the space
below, so nothing extends under the footprint. Snapshot cameras (which frame on the shown bounds)
then keep the house readable.

**Model edit.** The pipeline capability is independent of any building. The owner specified four
front steps, so elmstead's street level is derived from four 150 mm risers — a provisional 600 mm
drop, noted in `models/elmstead/shared.ts`; update the riser when the threshold-to-path drop is
measured. The capability is exercised by elmstead and the schema, render and IFC tests.

## Risks / Trade-offs

- [An extra storey shows in the selector, plan set and IFC] → it is a real level holding external
  works; name it clearly (e.g. "Street level") and treat its plan as a site plan.
- [`styleOf` nearest-matches ground to stair, wall or slab] → keep ≥0.02 RGB distance from every
  `STYLES` entry and add a recognition test.
- [Green ground churns the plan-versus-3D comparison] → ground classifies as neither wall, room nor
  paper and is skipped; the comparison is live and has no snapshots, so only committed snapshots
  (currently the cottage plan SVG) need review, and the cottage has no ground.
- [A second stair bands on the shared riser] → accepted for now; the shared riser is the largest
  (the main stair's 182.35 mm), the front steps' 150 mm risers alternate under it, and the spec
  states the behaviour; revisit if the visual grates.
- [The external storey breaks tests that assume the ground floor is lowest and every storey has
  walls] → update the elmstead floor-structure test, make the per-storey plan-vs-3D loop skip
  wall-less storeys, and update the storey-selector expectation; add `npm test` to the model edit's
  verification.
- [Byte-identical has no committed IFC golden] → verify it with a manual pre/post build diff, not a
  test that only checks determinism.
- [A large ground slab shrinks the house in snapshots] → modest extent; eye-check the snapshots.
- [Walk entry shifts to street level and the footprint centre moves with the ground slab] → modest
  extent keeps the centre near the house; verify the entry pose.
- [Existing models must stay byte-identical] → default `concrete`; confirm the example cottage's IFC
  and snapshots are unchanged.

## Migration Plan

Additive optional field; no existing model needs editing. Regenerate `schema/building.schema.json`
and the plan SVG snapshot (the plan-versus-3D comparison is live and has no snapshots). Rollback is
removing the field and the `ground` style entries; existing models are unaffected because they
default to `concrete`.

## Open Questions

- The exact ground colour and the ground slab's extent are aesthetic/model choices that can be settled
  during implementation without changing the specs or approach.
- elmstead's exact riser awaits the threshold-to-path drop measurement; the owner has specified
  four steps, and the 150 mm riser is provisional.