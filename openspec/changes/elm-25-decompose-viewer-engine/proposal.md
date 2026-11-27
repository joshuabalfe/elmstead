# Proposal

## Why

`src/frontend/scene/engine.ts` is one 2,658-line closure holding 54 mutable `let`s and at least
eight subsystems: model loading/residency, the storey section sweep, shader style patches, walk
mode, the measurement tool, hover identification, Diff dressing and ghosts, and view crossfades.
ELM-21 moved the UI to React but left the scene monolithic. Every viewer feature diffs against the
whole file; the scene wiring is only testable through Chromium at ~2 minutes per file on CI, while
the maths already lives in `lib/` and is unit-tested. With the repo growing fast (20 changes
archived in the last week, three viewer changes in the last two days), this is the simplicity cost
that compounds with every viewer feature.

## What Changes

- Extract five self-contained scene modules beside the engine, each owning its state and exposing
  a narrow interface: `measure.ts` (the tool), `walk.ts` (the mode), `identify.ts` (hover ids),
  `dress.ts` (Diff highlights, outlines, ghosts, plan fade), `storey-motion.ts` (the section sweep).
- A `SceneContext` interface (`scene/context.ts`) gives modules accessor-based reads of the shared
  state the engine owns (current model, model JSON, storey selection, view state, epochs) — no
  stale closure snapshots.
- The engine keeps world/camera setup, URL params, loading/residency, labels and plan overlays,
  style patches, view framing, the serialisation chains and the `ViewerApi`; target ≤ ~1,000 lines.
- Staged as runnable commits, one module per stage, the full viewer suite green at every stage.
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
  `storey-motion.ts`; `engine.ts` shrinks to orchestration.
- Tests: the existing viewer suites are the safety net and stay unchanged; fast unit tests are
  added where extraction exposes pure logic.
- `docs/architecture.md` — the frontend module layout.
- No new dependencies. Residual coupling: ELM-23 adds a settled-view hook to `chooseView` and
  ELM-24 deletes the owner map in `storeyItemsOf`; whichever lands second re-cuts those spots.
  Independent of ELM-26.
