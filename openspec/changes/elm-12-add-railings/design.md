# Design

## Context

See proposal.md - Why. The pipeline is storey-based: elements live in a storey's arrays, plans are
drawn from the model, and IFC is written by `src/ifc/writer.ts` from the JSON contract. Derived
vertical geometry already has a precedent in stairs: authored plan geometry plus two storey
elevations, with riser, going and levels computed in `src/geometry/stair.ts` and shared by the
writer, plans and the round-trip. Presentation is type-keyed: `STYLES` in `src/ifc/styles.ts` is
recognised by the viewer, and the plan palette `C` in `src/render/style.ts` is what the
plan-versus-3D comparison classifies. web-ifc 0.0.80 provides `IfcRailing` and
`IfcRailingTypeEnum` (`HANDRAIL`, `GUARDRAIL`, `BALUSTRADE`; `FENCE` is IFC4X3 only).

## Goals / Non-Goals

**Goals:**

- One small element that expresses both a level external guard and a sloped handrail beside steps
  or a ramp.
- Reuse the stair philosophy: author plan geometry and two walking-surface offsets; derive the
  sloping rail, post positions and volumes in one geometry module.
- Keep every model without railings byte-identical in IFC and snapshots.

**Non-Goals:**

- Curved or multi-segment railings (model several straights), balusters, infill panels, gates or
  mid-rails.
- Attaching a railing to a stair object or deriving its bases from the stair automatically.
- Wall-mounted brackets, structural design or code checking of handrail heights.
- Railings inside the internal stair in this change; elmstead's front steps are the first use.

## Decisions

**A straight `Railing` with `start`, `end`, `height`, `startBase`, `endBase`.** The run is a
line; `height` is the top of the rail above the walking surface; the bases are that surface at each
end, relative to the storey floor. An omitted base is 0, so a level guard at floor level needs no
bases and a partial pair is still well defined. Equal effective bases give a level guard; different
effective bases give a sloped handrail. This covers an external free-standing rail and the
front-steps rail without tying the element to a stair. The model derives the slope from its own constants
(`frontStepRisers × frontStepRiser`), so no elevation is duplicated as a literal. Alternatives
rejected: a 3D path with a height per point (bigger schema, stores what can be derived); railings
attached to stair flights (cannot express a free-standing external guard, and adds a cross-element
reference and its checks); a thin low wall (solid IfcWall, wall colour and plan treatment, against
the schema rule).

**Optional `railings` array, like `stairs`.** Omitted in every existing model, so the JSON, IFC
and snapshots stay byte-identical. The schema adds `RailingSchema` and
`railings: z.array(RailingSchema).optional()`; there is no default, matching `stairs`.

**Derived geometry in `src/geometry/railing.ts`.** One module computes:
- the plan run (the start→end distance), the 3D rail line and the vertical offset from the rail's
  top surface to its centreline (half the 40 mm depth, divided by the run's cosine);
- post positions: both ends plus evenly spaced intermediates,
  intervals = max(1, ceil(planRun / 160)), so posts are never more than 160 mm apart;
- part volumes: the top rail's 3D length × 50 mm × 40 mm and each post's 40 mm × 40 mm × height.

A zero plan run is a model-check ERROR, not a geometry fallback. The writer, the round-trip and the
plan use the same functions. Posts run from the walking surface to the rail's top surface, so they
overlap the rail; the IFC body lists each part as its own solid, and web-ifc meshes them
additively, so the round-trip sums the same part volumes the model expects (door and window frames
use the same additive convention).

**IFC mapping.** Each railing is one `IfcRailing` contained in its storey, with `Tag` = id and
`Name` = name or id. `PredefinedType` is `HANDRAIL` when the effective bases differ (an omitted
base is 0) and `GUARDRAIL` when they are equal. The body is a Body/SweptSolid shape of extruded
boxes: the top rail is positioned with its local Z along the 3D run, a horizontal ref direction
across it and its top surface at `height`; each post is a vertical box from the walking surface to
the rail's top. The IFC test asserts those axes and the extrusion depth, not only the volume,
because a vertical box with the same volume would pass a volume-only round-trip. All parts carry
the `railing` surface style.

**Plan symbol and extent.** `renderPlan` draws each railing as a line from start to end in
`C.railing`, with a 40 mm tick across the run at each derived post, and with `--ids` draws the
railing's id like any other element. Railings are drawn after walls and openings and before stairs,
so stairs remain the last geometry layer. `makeView` takes a railing-extent option: `renderPlan`
includes the railing endpoints so an external railing beyond every room, slab and stair is on the
sheet, while `renderFloor`, `renderWallTops` and `renderPlanAnnotations` keep their existing extent
and draw no railing. The viewer's plan overlay is therefore unchanged; it shows the IFC railing
geometry instead.

**Two colour contracts.** `STYLES.railing` must be at least 0.02 RGB from every other style entry so
the viewer's nearest-match recognises it. `C.railing` must classify as neither wall, room nor paper
in the plan-versus-3D comparison (±5 per channel), so railing pixels are skipped like stair pixels.
The same dark slate value serves both: `#4a515a` (0.290, 0.318, 0.353). Because both plan and 3D
railing pixels are "other", the comparison does not verify railing positions; the IFC round-trip and
the plan test do.

**Viewer: one visibility mapping, no presentation code.** Adding `railing` to `STYLES` makes
`styleOf` recognise it. Unlike walls and slabs it gets no top patch, so it keeps its IFC colour in
plan style and 3D, like stairs (which have their own readability shader). Snapshots show it in that
colour. The viewer does need to add railing ids to `applyStoreyVisibility`'s owner map, otherwise
they stay visible when their storey is hidden, and to `shownBox`, so an outlying railing is framed.
Hover labels need no change: `elementLabels` is built from every item's Tag.

**Model: three railings on elmstead's street storey.** The flight's nosings run from 150 mm at the
first tread to 600 mm at the threshold. The step rails' base line must follow that surface: bases
0→600 would give a slope of 0.667 against the nosings' 0.5 and leave the rail only 750–900 mm above
them. Each step railing therefore starts 20 mm up the flight (half the 40 mm post, so the bottom
post sits wholly on the first tread) at base 150 mm, and ends at the wall at base 600 mm. Its
centreline is 100 mm inside the 2000 mm flight edge (the 50 mm rail's outer face is 75 mm in). The
top post is wall-fixed (half embedded in the west wall); the bottom post is a newel on the first
tread. The step rail is 890–900 mm above the nosings and exactly 900 mm above the tread and
threshold at its ends.

A third, level railing continues the south step rail from the bottom of the steps south along the
front of the house at street level (owner correction). It sits on the ground slab's edge line
(x = −900) from the south step's bottom (y = 6525) to the south corner (y = 0), base 0 (street),
height 900. It is level and on the street storey, so all three external railings hide with the
street; it edges the front at the foot of the steps, not the ground floor at the top.

The 900 mm height is recorded in `models/elmstead/shared.ts` as provisional pending the owner's
measurement. The street storey is correct because the railings accompany the street→ground stair;
they are external, so they sit with the ground rather than inside the house.

**Checks.** Add railings to the unique-id walk and add a zero-plan-run ERROR, following the wall and
flight precedents. The schema already guarantees positive height and non-negative bases. No
collision or clearance checks.

## Risks / Trade-offs

- [IfcRailing may not render in Fragments] → it is a standard building element with a swept-solid
  body; build, round-trip and eye-check the viewer early. If Fragments drops it, the fallback is a
  representation Fragments accepts (e.g. a single swept profile), not a schema change.
- [The 900 mm height is an unmeasured model choice] → it lives beside the model with a note;
  changing it changes only the railing value, not the schema.
- [The bottom and top posts have deliberate end conditions] → the bottom post sits wholly on the
  first tread and the top post is fixed into the west wall; both are stated in the model and
  eye-checked, and a different newel/inset is a model tweak, not a schema change.
- [A railing drawn over a wall would mask wall pixels and could shift the comparison's long-run
  alignment] → railings run along edges and openings and elmstead's are clear of walls; the
  synthetic comparison test keeps its railing clear of walls. Accepted.
- [Railing pixels are ignored by the plan-versus-3D comparison] → accepted, as for stairs; the
  round-trip and plan tests cover the railing itself, and the comparison's job is walls, rooms and
  openings.
- [A railing's sloped rail may appear to float where posts meet it] → posts reach the rail top
  inside the rail box, so the joint is hidden; the overlap is bounded by the post section and does
  not affect the expected volume convention.
- [Generated schema and snapshots change] → regenerate them; the cottage has no railings, so its
  snapshot should not change. Verify the cottage IFC is byte-identical before and after.
- [An outlying railing grows the plan sheet] → the plan extent includes it, and the viewer overlay
  keeps its own extent. Elmstead's level front railing runs along the ground slab edge, which the
  street extent already covers, so the street plan is unchanged.

## Migration Plan

Additive optional array and a new style entry. No model must change; existing models omit
`railings` and produce byte-identical output. Rollback removes the array, the schema and the style
entries; models that used railings would fail validation and must drop them with the field.

## Open Questions

- The 900 mm railing height is provisional pending the owner's measurement; the 100 mm edge inset,
  20 mm bottom inset, 160 mm post spacing and `#4a515a` colour are settled design choices that
  can still change by eye without changing the specs.
- Whether the internal main stair should get a handrail is a model follow-up after this change.
