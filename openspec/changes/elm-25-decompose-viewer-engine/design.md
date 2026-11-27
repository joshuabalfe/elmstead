# Design

## Context

The engine closure's subsystems, with their state (line ranges approximate on current main):

| Subsystem        | State it owns                                                                                                     | Rough lines |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ----------- |
| Measurement tool | measurements, pendingPoint, measureEpoch, pick queue, pointer set, measureLayer + materials                       | 1498–1730   |
| Walk mode        | savedView, pointerLockControls, walkKeys, walkRaf, eye height                                                     | 1335–1497   |
| Hover identify   | elementLabels, hoverSprite, hover queue/epoch, lastPointer                                                        | 1731–1832   |
| Diff dressing    | shownDiff usage, diffOutlines, ghostModel/items/labels, outlineMaterials, fadePlan                                | 1999–2342   |
| Storey sweep     | storeyMotion, storeyChain, settledStoreys, sweepPlane, storeyItemCache, layer fades                               | 712–1078    |
| Labels/plan      | labels/constraints/planLayers, flatLabels, loadLabels and its builders, storeyLayers                              | 172–588     |
| Diff state       | shownDiff, baseJson, shownCategories, refreshDiff, publishChanges                                                 | ~1550–1700  |
| Style patches    | style, patchTops, patchMaterial, stair bands/edges, applyStyle                                                    | ~704–842    |
| Engine keeps     | world/camera/renderer, params, residency/load, storey selection, setView/setCamera, compass, viewChain, ViewerApi | rest        |

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
- The five tool modules were the first stage. They left the engine at ~1,270 lines, still well over
  the target, so the presentation layers, the revision-diff state and the style patches followed.
  This is the revisit the earlier draft of this design allowed for.

## Decisions

### D1: Modules and interfaces

Each module exports a factory taking `(ctx: SceneContext, …narrow deps)` and returning its API:

- `createMeasureTool(ctx)` → `{ requested, setMeasuring, toggle, clear }`; owns its layer,
  materials, pick queue and pointer listeners; calls `ctx.exitWalk()` on toggle-on as today.
- `createWalkMode(ctx)` → `{ requested, enter, exit, toggle, isWalking }`; owns savedView,
  pointer lock, keys and rAF; reads `ctx.shownBox()` and `ctx.lowestElevation()`; calls
  `ctx.onWalkExit()` for the compass/label/repick refresh the engine does today.
- `createIdentify(ctx)` → `{ requested, setIdentifying, isIdentifying, repick, hide, reset,
labelsFor(model) }`; owns the hover sprite and queue; reads `ctx.currentModel()`,
  `ctx.ghostModel()`, `ctx.ghostLabel()`, `ctx.diffStatusOf(id)`.
- `createDresser(ctx)` → `{ dress, undress, clearGhost, fadePlan, ghostModel, ghostLabel,
setStoreyVisibility }`; owns outlines, ghosts and their materials; uses `ctx.loadResident()` for
  the ghost base and `ctx.storeyIndex()`.
- `createStoreyMotion(ctx)` → `{ apply, finish, reset }`; owns the sweep plane, entries, item
  cache and retarget chain; reads `ctx.storeyLayers()`, `ctx.modelJson()`, `ctx.isShown()` and
  the view state.
- `createLabels(ctx)` → `{ clear, constraints, build, updateOrientation, setLabelsVisible,
setConstraintsVisible, setPlanVisible }`; owns the label, constraint and plan groups, the flat
  labels and the storey layer map; reads the shown diff for its recoloured layers.
- `createDiffMode(ctx)` → `{ shown, statusOf, note, refresh, publish, setCategory, forget }`;
  owns the revision diff, the base JSON cache, the category filter and the changes panel state.
- `createStyle(ctx, grid)` → `{ setModel, apply, patchMaterial, addStairEdges,
applyStairPresentation }`; owns the plan shader patches, the stair banding and edges, the
  background and the grid.

### D2: SceneContext — accessors, not values

`scene/context.ts` defines the interface (types only, no engine import → no cycles). The engine
implements it with **getter functions** for mutable shared state (`currentModel()`, `modelJson()`,
`shownStoreys()`, `viewState()`, `loadEpoch()`, `shownDiff()`, `storeyLayers()`, `storeyIndex()`,
`lowestElevation()`, `loadResident()`), the stable scene services (`snapshot`, `store`, `scene`,
`camera`, `renderer`, `fragments`, `canvas`, `params`) and the late-bound cross-module actions
(`exitWalk()`, `hideHover()`, `repickHover()`, `onWalkExit()`, `publishChanges()`). Passing values
would capture stale closures — the exact bug class the engine's epoch guards exist to prevent.
Tool-local epochs (measure, hover) move into their modules; `loadEpoch` stays with the engine and
is read through the accessor. The `window.__elmstead*` declarations live here too, so every module
sees the same test-hook contract.

### D3: Serialisation stays in the engine

`viewChain` remains engine-owned: the engine wraps view changes exactly as it does today. The
storey sweep's retarget chain is internal to `storey-motion.ts`, since every retarget starts and
settles there. Modules keep their own single-flight queues (pick, hover) and rAF loops; a module
never starts a second loop for the same animation. The sweep's retarget semantics move verbatim —
they are the most timing-sensitive code and are covered by the storey-keys/selection suites.

### D4: Staged commits

1. `context.ts` + extract **measure** (largest clean boundary, ~300 lines out).
2. Extract **walk** (~200).
3. Extract **identify** (~150).
4. Extract **dress** (~350).
5. Extract **storey-motion** (~370).
6. Extract **labels** (~420): the five above left the engine over target.
7. Extract **diff-mode** (~180): the revision diff state and changes panel.
8. Extract **style** (~140): the shader patches and stair presentation.
9. Tidy: engine doc comment, dead imports, `docs/architecture.md`.

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
- **Residual coupling** with ELM-23 (`chooseView` hook) and ELM-24 (owner map): both landed before
  this change, and the extraction re-cut around their settled-view hook and deleted owner map.

## Acceptance / Migration

1. Full suite green at every stage; `npm test` (all viewer files) green at the end.
2. Render `models/elmstead` and the cottage before/after: snapshot PNGs byte-identical.
3. `engine.ts` ≈1,050 lines (814 code lines), within ~5% of the ~1,000 target and down from
   2,681; each module owns its state (no tool state left in the engine).
4. Every `window.__elmstead*` hook still declared and behaving identically (the suites assert them).
