# Design

## Context

See proposal.md - Why. The pipeline is storey-based: elements live in a storey's arrays, plans are
drawn from the model, and IFC is written by `src/ifc/writer.ts` from the JSON contract. Derived
vertical geometry already has a precedent in stairs: authored plan geometry plus two storey
elevations, with riser, going and levels computed in `src/geometry/stair.ts` and shared by the
writer, plans and the round-trip. Presentation is type-keyed: `STYLES` in `src/ifc/styles.ts` is
recognised by the viewer, and the plan palette `C` in `src/render/style.ts` is what the
plan-versus-3D comparison classifies. web-ifc 0.0.80 provides `IfcRailing` and
`IfcRailingTypeEnum` (HANDRAIL, GUARDRAIL, BALUSTRADE, FENCE).

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
line; `height` is the top rail above the walking surface; the bases are that surface at each end,
relative to the storey floor. Equal bases give a level guard; different bases give a sloped
handrail. This covers an external free-standing rail and the front-steps rail without tying the
element to a stair. The model derives the slope from its own constants
(`frontStepRisers × frontStepRiser`), so no elevation is duplicated as a literal. Alternatives
rejected: a 3D path with a height per point (bigger schema, stores what can be derived); railings
attached to stair flights (cannot express a free-standing external guard, and adds a cross-element
reference and its checks); a thin low wall (solid IfcWall, wall colour and plan treatment, against
the schema rule).

**Optional `railings` array, like `stairs`.** Omitted in every existing model, so the JSON, IFC
and snapshots stay byte-identical. The schema adds `RailingSchema` and
`railings: z.array(RailingSchema).optional()`; there is no default, matching `stairs`.

**Derived geometry in `src/geometry/railing.ts`.** One module computes:
- the plan run and the 3D rail line (bases + height);
- post positions: both ends plus evenly spaced intermediates, intervals = max(1, ceil(run / 1200)),
  so posts are never more than 1200 mm apart;
- part volumes: the top rail's 3D length × 50 mm × 40 mm and each post's 40 mm × 40 mm × height.

The writer, the round-trip and the plan use the same functions. End posts and the top rail overlap
where they meet; the IFC body lists each part as its own solid, and web-ifc meshes them additively,
so the round-trip sums the same part volumes the model expects (door and window frames use the same
additive convention).

**IFC mapping.** Each railing is one `IfcRailing` contained in its storey, with `Tag` = id and
`Name` = name or id. `PredefinedType` is `HANDRAIL` when the bases differ and `GUARDRAIL` when they
are equal. The body is a Body/SweptSolid shape of extruded boxes: the top rail is positioned with
its local Z along the 3D run and a horizontal ref direction across it; each post is a vertical box
from the walking surface to the rail. All parts carry the `railing` surface style.

**Plan symbol and extent.** `renderPlan` draws each railing as a line from start to end in
`C.railing`, with a 40 mm tick across the run at each derived post. Railings are drawn after walls
and openings and before stairs, so stairs remain the last geometry layer. `makeView` includes the
railing endpoints, so an external railing beyond every room and slab is on the sheet.
`renderFloor`, `renderWallTops` and `renderPlanAnnotations` do not draw railings, keeping the
viewer's plan overlay unchanged; the viewer shows the IFC railing geometry instead.

**Two colour contracts.** `STYLES.railing` must be at least 0.02 RGB from every other style entry so
the viewer's nearest-match recognises it. `C.railing` must classify as neither wall, room nor paper
in the plan-versus-3D comparison (±5 per channel), so railing pixels are skipped like stair pixels.
The same dark slate value serves both: `#4a515a` (0.290, 0.318, 0.353). Because both plan and 3D
railing pixels are "other", the comparison does not verify railing positions; the IFC round-trip and
the plan test do.

**Viewer needs no code change.** Adding `railing` to `STYLES` makes `styleOf` recognise it. Unlike
walls and slabs it gets no top patch, so it keeps its IFC colour in plan style and 3D, like stairs
(which have their own readability shader). Snapshots show it in that colour.

**Model: two railings on elmstead's street storey.** They run alongside the front flight at the
flight edges, inset 25 mm so the 50 mm rail lies within the 2000 mm steps, from the bottom of the
run (street, base 0) to the threshold (ground, base = four risers × 150 mm = 600 mm). The height is
900 mm, recorded in `models/elmstead/shared.ts` as provisional pending the owner's measurement.
The street storey is correct because the railing accompanies the street→ground stair; it is
external, so it sits with the ground rather than inside the house.

**Checks.** Add railings to the unique-id walk and add a zero-plan-run ERROR, following the wall and
flight precedents. The schema already guarantees positive height and non-negative bases. No
collision or clearance checks.

## Risks / Trade-offs

- [IfcRailing may not render in Fragments] → it is a standard building element with a swept-solid
  body; build, round-trip and eye-check the viewer early. If Fragments drops it, the fallback is a
  representation Fragments accepts (e.g. a single swept profile), not a schema change.
- [The 900 mm height and 25 mm inset are unmeasured model choices] → both live beside the model with
  a note; changing them changes only the railing values, not the schema.
- [Railing pixels are ignored by the plan-versus-3D comparison] → accepted, as for stairs; the
  round-trip and plan tests cover the railing itself, and the comparison's job is walls, rooms and
  openings.
- [A railing's sloped rail may appear to float where posts meet it] → posts reach the rail top
  inside the rail box, so the joint is hidden; the overlap is bounded by the post section and does
  not affect the expected volume convention.
- [Generated schema and snapshots change] → regenerate them; the cottage has no railings, so its
  snapshot should not change. Verify the cottage IFC is byte-identical before and after.
- [The street plan grows to include railings beyond the ground slab] → the extent includes them and
  the plan stays a site plan; eye-check the framing.

## Migration Plan

Additive optional array and a new style entry. No model must change; existing models omit
`railings` and produce byte-identical output. Rollback removes the array, the schema and the style
entries; models that used railings would fail validation and must drop them with the field.

## Open Questions

- The railing height, inset, post spacing (fixed at 1200 mm) and colour are model/aesthetic choices
  that can be settled by eye without changing the specs.
- Whether the internal main stair should get a handrail is a model follow-up after this change.
