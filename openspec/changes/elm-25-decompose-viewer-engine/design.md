# Design

## Context

The engine closure's subsystems, with their state (line ranges approximate on current main):

| Subsystem        | State it owns                                                                                                                   | Rough lines |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Measurement tool | measurements, pendingPoint, measureEpoch, pick queue, pointer set, measureLayer + materials                                     | 1498–1730   |
| Walk mode        | savedView, pointerLockControls, walkKeys, walkRaf, eye height                                                                   | 1335–1497   |
| Hover identify   | elementLabels, hoverSprite, hover queue/epoch, lastPointer                                                                      | 1731–1832   |
| Diff dressing    | shownDiff usage, diffOutlines, ghostModel/items/labels, outlineMaterials, fadePlan                                              | 1999–2342   |
| Storey sweep     | storeyMotion, storeyChain, settledStoreys, sweepPlane, storeyItemCache, layer fades                                             | 712–1078    |
| Engine keeps     | world/camera/renderer, params, residency/load, labels/overlays, style patches, setView/setCamera, compass, viewChain, ViewerApi | rest        |

The maths is already extracted (`lib/measure.ts`, `lib/walk.ts`, `lib/view.ts`, `lib/diff.ts`) and
unit-tested; what remains monolithic is the scene wiring.

## Goals / Non-Goals

**Goals**

- Each tool/mode is a module with owned state and a narrow interface; the engine orchestrates.
- Every stage runs: full viewer suite green per commit, byte-identical PNGs at the end.
- The window-hook contract, URL params and pixels are unchanged.

**Non-Goals**

- No behaviour or presentation change; no new viewer capability.
- No rewrite of the Fragments/ThatOpen interaction or the shader patches.
- No consolidation of the `window.__elmstead*` hooks (touches every viewer test; separate tweak if
  ever wanted).
- Not extracting labels/overlays or style patches in this change — they are entangled with load
  and residency; revisit only if the engine is still too large afterwards.

## Decisions

### D1: Modules and interfaces

Each module exports a factory taking `(ctx: SceneContext, …narrow deps)` and returning its API:

- `createMeasureTool(ctx)` → `{ setMeasuring, toggle, clear, dispose }`; owns its layer, materials,
  pick queue and pointer listeners; calls `ctx.exitWalk()` on toggle-on as today.
- `createWalkMode(ctx)` → `{ enter, exit, toggle, isWalking }`; owns savedView, pointer lock, keys,
  rAF; reads `ctx.shownBox()` and `ctx.lowestElevation()`; calls `ctx.onWalkExit()` for the
  compass/label/repick refresh the engine does today.
- `createIdentify(ctx)` → `{ setIdentifying, repick, hide, labelsFor(model) }`; owns hover sprite
  and queue; reads `ctx.currentModel()`, `ctx.ghostModel()`, `ctx.diffStatusOf(id)`.
- `createDresser(ctx)` → `{ dress, undress, fadePlan }`; owns outlines, ghosts and their materials;
  uses `ctx.loadResident()` for the ghost base and `ctx.storeyIndex()`.
- `createStoreyMotion(ctx)` → `{ apply, finish, settled }`; owns the sweep plane, entries and
  chain; reads `ctx.storeyLayers()`, `ctx.storeyItemsOf()`, `ctx.xray()`.

### D2: SceneContext — accessors, not values

`scene/context.ts` defines the interface (types only, no engine import → no cycles). The engine
implements it with **getter functions** for mutable shared state (`currentModel()`, `modelJson()`,
`shownStoreys()`, `viewState()`, `loadEpoch()`, `snapshot`, `store`, `world`, `fragments`, `canvas`,
`params`). Passing values would capture stale closures — the exact bug class the engine's epoch
guards exist to prevent. Tool-local epochs (measure, hover) move into their modules; `loadEpoch`
stays with the engine and is read through the accessor.

### D3: Serialisation stays in the engine

`viewChain` and `storeyChain` remain engine-owned: the engine wraps module operations in the chains
exactly as it wraps its own today. Modules keep their internal single-flight queues (pick, hover)
and rAF loops; a module never starts a second loop for the same animation. The storey sweep's
retarget semantics (ELM-69/70) move verbatim — they are the most timing-sensitive code and are
covered by the storey-keys/selection suites.

### D4: Staged commits

1. `context.ts` + extract **measure** (largest clean boundary, ~300 lines out).
2. Extract **walk** (~200).
3. Extract **identify** (~150).
4. Extract **dress** (~350).
5. Extract **storey-motion** (~370).
6. Tidy: engine doc comment, dead imports, `docs/architecture.md`.

Each stage: `npm run typecheck`, the full viewer suites, `npm test`. If a stage reveals a boundary
is wrong, fix the boundary in that stage rather than carrying a half-move forward.

### D5: Test strategy

The Chromium suites are the regression net and stay unchanged. Where extraction exposes pure
logic (e.g. a fade-state reducer), add fast unit tests beside `lib/`. No new heavy test file — the
CI groups (ELM-26's subject) are untouched.

## Risks / Trade-offs

- **Closure-state subtleties** (epochs, held frames, ghost lifecycle) — mitigated by D2 accessors,
  verbatim moves, and per-stage suites; the byte-identical PNG check catches visual drift.
- **Circular imports** — context.ts is types-only; modules import it and three.js, never the engine.
- **Review size** — large but mechanical; the staged commits make each step reviewable, per the
  repo's full-coherent-split preference.
- **Residual coupling** with ELM-23 (`chooseView` hook) and ELM-24 (owner map): whichever lands
  second re-cuts; both are small, named spots.

## Acceptance / Migration

1. Full suite green at every stage; `npm test` (all viewer files) green at the end.
2. Render `models/elmstead` and the cottage before/after: snapshot PNGs byte-identical.
3. `engine.ts` ≤ ~1,000 lines; each module owns its state (no tool state left in the engine).
4. Every `window.__elmstead*` hook still declared and behaving identically (the suites assert them).
