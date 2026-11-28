# Proposal

## Why

`src/frontend/scene/engine.ts` is one 2,649-line closure holding 52 mutable `let`s and at least
eight subsystems: model loading/residency, the storey section sweep, shader style patches, walk
mode, the measurement tool, hover identification, Diff dressing and ghosts, and view crossfades.
ELM-21 moved the UI to React but left the scene monolithic. Every viewer feature diffs against the
whole file; the scene wiring is only testable through Chromium at ~2 minutes per file on CI, while
the maths already lives in `lib/` and is unit-tested. With the repo growing fast (20 changes
archived in the last week, three viewer changes in the last two days), this is the simplicity cost
that compounds with every viewer feature.

## What Changes

- Extract the scene's subsystems into self-contained modules beside the engine, each owning its
  state and exposing a narrow interface: `measure.ts` (the tool), `walk.ts` (the mode),
  `identify.ts` (hover ids), `dress.ts` (Diff highlights, outlines, ghosts, plan fade),
  `storey-motion.ts` (the section sweep), `labels.ts` (room, dimension, plan and constraint
  layers), `diff-mode.ts` (the revision diff, status map and changes panel) and `style.ts` (plan
  shader patches, stair banding, background and grid).
- A `SceneContext` interface (`scene/context.ts`) gives modules accessor-based reads of the shared
  state the engine owns (current model, model JSON, storey selection, view state, epochs) — no
  stale closure snapshots.
- The engine keeps world/camera setup, URL params, loading/residency, storey selection, view
  framing, the serialisation chains and the `ViewerApi`; ≈1,050 lines, down from 2,649. The five
  planned tool modules left it at ~1,270, so labels, Diff state and style followed.
- Extracted in stages with the full viewer suite green at each; landed as one implementation commit plus the two sibling merge commits (#82, #83).
- **No behaviour change:** every `window.__elmstead*` hook, URL param, pixel output and UI
  interaction is preserved. Acceptance includes byte-identical snapshot PNGs.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — `skip_specs: true`, following ELM-18/ELM-20 precedent: a pure internal refactor that
preserves every ifc-viewer requirement, test hook and output byte. No spec contract changes.)

## Impact

- `src/frontend/scene/` — new `context.ts`, `measure.ts`, `walk.ts`, `identify.ts`, `dress.ts`,
  `storey-motion.ts`, `labels.ts`, `diff-mode.ts` and `style.ts`; `engine.ts` shrinks to
  orchestration.
- Tests: the existing viewer suites are the safety net and their assertions are unchanged (one import moved); fast unit tests are
  added where extraction exposes pure logic (`lib/storeys.ts`: ordering, prefix check and `storeyTop`).
- `docs/architecture.md` — the viewer's scene module layout.
- No new dependencies. ELM-23's settled-view hook and ELM-24's owner-map deletion both landed
  before the moves, so the extraction re-cut around them. Main then moved twice more: #82
  (free-fly camera) and #83 (winder stairs) were merged in, their semantics moved into
  `scene/walk.ts` and `scene/style.ts` rather than dropped.
