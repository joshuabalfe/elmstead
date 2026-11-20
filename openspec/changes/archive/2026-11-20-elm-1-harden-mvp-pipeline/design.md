# Design

## Context

See `proposal.md` for motivation and the delta specs for required behaviour. The pipeline is
currently split so that `src/schema` owns shape, `src/checks` owns cross-element rules, and
`src/cli` is the only module that knows the `out/` layout. Only component checks exist today, and
several modules assume the process starts at the project root.

## Goals / Non-Goals

**Goals:**
- Make every schema-valid but semantically invalid model fail with a model id, before output is
  written.
- Make failures recoverable and testable: no raw stacks, no leaked servers, no partial files.
- Keep deterministic output and the existing schema unchanged.
- Add enough automated coverage that the above cannot regress.

**Non-Goals:**
- New element types or schema fields (room heights, stairs, roofs, curved walls).
- Changing the IFC mapping beyond window partitioning.
- Importing external IFC or editing generated files by hand.
- Reworking the viewer's rendering or plan annotation design.

## Decisions

### One `checkModel` aggregator; checks stay pure
Add `src/checks/model.ts` with `checkModel(model): Issue[]`, composing `checkComponents`,
`checkIds`, `checkWalls`, `checkOpenings` and `checkOutlines`. Checks stay pure, take a parsed
`BuildingModel` and return issues; they never write or exit. `build` and `render` both call it, so
the same rules gate every output. Alternatives: put rules in the zod schema (rejected because
they are cross-element and the schema is the JSON contract, not a plan checker) or in the writer
(rejected because errors must name the model, not an IFC step id).

### Id uniqueness uses one table across every id-bearing node
Walk the model once and collect `(id, kind)` for project, site, building, storeys, walls, openings,
slabs, rooms and components. The first occurrence wins; a later duplicate is an ERROR whose message
names both kinds ("id is used by a wall and a window component", "id is used by two rooms"), or
keeps "component id is used twice" when both are components. The component-only loop moves out of
`checkComponents` so nothing is reported twice. This catches collisions that also collide in the
GlobalId keyspace (`ifcGuid(id)`), including element/component collisions that the current
component-only check misses.

### Opening fit and overlap use geometry helpers
Use `wallLength` for the fit test with a small tolerance (`1e-6` mm) because wall lengths are
square roots of integer coordinates. Openings touching at an edge are allowed; overlap requires
strict intersection on both the along-wall interval and the vertical interval. Report against both
openings so either id in the message leads to a fix.

### Polygon validity helper in `src/geometry/polygon.ts`
Add `polygonProblems(pts)` returning a list of short reasons. It checks distinct points, open
outline, any repeated point (not only adjacent), non-zero area and self-intersection. For
self-intersection it combines `segmentsCross` with an inclusive on-segment test, so non-adjacent
edges that touch at an endpoint or overlap collinearly are caught; adjacent edges are additionally
rejected when they double back along the same ray. Straight collinear continuation is allowed.
Concave room and slab outlines remain valid.

### CLI owns the error boundary
`loadModel` already returns `LoadResult` and never exits; the `process.exit(1)` is in the CLI's
`load()` wrapper. Remove that wrapper and let `main` wrap dispatch in `try/catch`; a caught
unexpected pipeline error becomes `{ level: "ERROR", id: <model path>, message }` and returns 1.
Model-evaluation errors keep their stack inside the issue message. `validateIfc` parses each stdout
line defensively and turns an unparseable line or missing summary into issues. This keeps expected
model errors and unexpected failures on the same reporting path.

### Paths resolve from the module location; output dir is explicit
Add `src/root.ts` exporting `PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url))` (from
`src/`) and `outDir()` returning `ELMSTEAD_OUT_DIR` when set, otherwise `join(PROJECT_ROOT, "out")`.
The CLI, validator bridge and snapshot driver use these. The viewer config already resolves from
its own location. This makes the CLI usable from any CWD and lets tests write to a temp directory.

### Atomic writes through one small helper
Add `src/io.ts` with `writeFileAtomic(path, data)`: write `<path>.<pid>.tmp` in the same directory,
then `renameSync` over the destination, removing the temp file on failure. JSON, IFC, SVG, PNG and
screenshot buffers all use it. A failed write leaves the previous file intact; deterministic file
contents are unchanged. `build` generates the JSON and IFC in memory before writing either, so a
writer throw cannot pair a new JSON with an old IFC. The viewer watcher listens for `add` as well
as `change`, because a rename can surface as either.

### Snapshot lifecycle is nested and failure-aware
`snapshot3d` starts the server, then enters `try/finally` that closes the browser (if launched) and
the server. `render3d` maps a missing Playwright executable to WARNING (plans still succeed) and
every other error to ERROR, so a viewer regression cannot masquerade as a warning.

### Viewer serving is confined and view input is validated
The Vite middleware resolves each request against the served directory and rejects paths whose
relative path escapes it (including encoded `..`), returning 404. The viewer builds model options
with `document.createElement("option")` and `textContent`, and validates `?view=` against the
five known views, falling back to `top`.

### Window partitioning follows the pane grid
IFC4 has no `MULTIPLE_PANEL` value. A shared helper maps the grid to `SINGLE_PANEL` for one pane,
`DOUBLE_PANEL_VERTICAL`/`DOUBLE_PANEL_HORIZONTAL` for two side by side/stacked,
`TRIPLE_PANEL_VERTICAL`/`TRIPLE_PANEL_HORIZONTAL` for three side by side/stacked, and `USERDEFINED`
with `UserDefinedPartitioningType` "<columns>x<rows> grid" for any other grid. Both `IfcWindowType`
and `IfcWindow` use the same value, so the type and its instances agree.

### Verification
Unit tests cover each check rule and polygon validity. The IFC test suite adds a multi-pane window
type assertion. CLI integration tests spawn `tsx src/cli/index.ts` with a temp output directory for
build/check/render failure paths. A small CI workflow runs typecheck, the fast tests and the full
suite (uv + Chromium) separately.

## Risks / Trade-offs

- **[Strict checks reject models that used to build]** → All new errors are model-level and have
  explicit test fixtures; the rules match the documented contract. Any example model that fails is
  fixed in the same change.
- **[Opening overlap may be intentional in future models]** → Start with ERROR, as overlapping
  cuts make the round-trip ambiguous; relax to WARNING only with a concrete use case.
- **[Atomic writes add temp files]** → Temp files live beside the destination and are renamed
  immediately; tests assert both success and previous-file preservation on failure.
- **[Validator stdout may be noisy]** → Any non-JSON line is an ERROR; `uv run --quiet` is already
  used, so unexpected output should fail loudly rather than be silently ignored.
- **[CI takes longer with uv and Chromium]** → Split into a fast job (typecheck, schema, unit tests)
  and a full job; cache npm and the uv cache.
- **[Viewer path check could reject legitimate symlinked outputs]** → `ELMSTEAD_OUT_DIR` is
  resolved explicitly; tests cover a normal out dir and a sibling escape attempt.

## Migration Plan

No data migration. The branch can be rolled back by reverting the change; generated files are
regenerated from models. After implementation, regenerate `schema/building.schema.json` only if
the schema changed (it should not), and update the plan SVG snapshot only if plan output changes
(it should not).