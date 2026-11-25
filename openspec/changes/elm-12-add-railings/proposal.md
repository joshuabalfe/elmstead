# Proposal

## Why

The pipeline can model the street storey and its front steps, but nothing can describe the railings
those steps need, and the same gap blocks every external guard or handrail. A `Wall` cannot express
an open post-and-rail assembly: it is a solid, full-height `IfcWall` with the wall colour and the
plan's wall treatment, so reusing one would misdescribe the building in IFC, plans and 3D — the repo
rule is not to approximate a missing type. A `Stair` has no railing concept and cannot stand guard
on level ground.

## What Changes

- Add an optional `railings` array to each storey and a new `Railing` element: a straight run from
  `start` to `end`, a top-rail `height`, and optional `startBase`/`endBase` giving the walking
  surface at each end relative to the storey floor. Equal bases give a level guard; different bases
  give a sloped handrail beside steps or a ramp. No other vertical geometry is stored.
- Export each railing as an `IfcRailing` contained in its storey, typed `HANDRAIL` when sloped and
  `GUARDRAIL` when level, with a body made of a top rail swept along the run and evenly spaced
  posts, in a new `railing` display colour.
- Draw railings on plans as a thin line with post ticks in a colour the plan-versus-3D comparison
  skips, include them in the plan's drawing extent (the viewer's plan overlay keeps its own extent),
  and give each an SVG `railing` group with its id and, with `--ids`, its label.
- Present railings in the viewer through the existing `STYLES` recognition; in plan style they show
  as IFC geometry like stairs. Map railings to their storey so the selector hides them with it, and
  include their points in the shown bounds.
- Add a `railing()` model helper.
- Model the two railings either side of elmstead's front steps, following the flight's pitch from the
  first tread to the threshold (150 → 600 mm) with a provisional 900 mm height, and a level railing
  along the front of the house at the bottom of the steps (owner correction).
- Regenerate the schema export and update docs and tests. Models without railings stay byte-identical.

## Capabilities

### New Capabilities

None. Railings extend the existing storey, plan, IFC and viewer capabilities.

### Modified Capabilities

- `building-schema`: a storey MAY hold optional railings; the `Railing` shape and its derived
  geometry contract.
- `model-authoring`: a `railing` helper for straight runs.
- `model-checks`: railing ids join the unique-id space and a zero-length run is an ERROR.
- `ifc-export`: railings become `IfcRailing` elements with a post-and-rail body and display colour.
- `ifc-verification`: the round-trip expects each railing's post and rail volumes.
- `plan-rendering`: a railing symbol, drawing extent and queryable SVG group.
- `ifc-viewer`: railings present in plan style and 3D and are skipped by the plan-versus-3D
  comparison.

## Impact

- Schema: `src/schema/schema.ts` and the regenerated `schema/building.schema.json`.
- New geometry: `src/geometry/railing.ts` for the plan run, post positions and part volumes.
- Pipeline: `src/checks/model.ts`, `src/ifc/writer.ts`, `src/ifc/roundtrip.ts`,
  `src/ifc/styles.ts`, `src/render/style.ts`, `src/render/plan.ts`, `src/model/helpers.ts`,
  `viewer/main.ts` (`styleOf` through `STYLES`, storey ownership and shown bounds).
- Model: `models/elmstead/street.ts` gains two railings; `models/elmstead/shared.ts` records the
  provisional height.
- Tests: schema, model checks, IFC, round-trip, plan rendering, plan-versus-3D classification and
  elmstead integration; regenerate the schema and any committed snapshot that changes.
- Docs: `docs/modelling.md` (element table, a railings section, not-modelled list) and
  `docs/rendering.md` (plan symbol and colour).
- No new dependencies and no change to existing models, whose `railings` array stays omitted.
