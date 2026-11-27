# Tasks

## 1. Before state

- [x] 1.1 Render `models/elmstead` and `models/examples/example-cottage`; record the snapshot PNG sha256 hashes.

## 2. Staged extraction (each stage: typecheck + full viewer suites + npm test)

- [x] 2.1 Add `src/frontend/scene/context.ts` (types-only SceneContext) and extract the measurement tool into `measure.ts`; engine implements the context and wires the tool's API.
- [x] 2.2 Extract walk mode into `walk.ts` (savedView, pointer lock, keys, rAF, entry/exit refresh through the context).
- [x] 2.3 Extract hover identification into `identify.ts` (labels map, hover sprite, pick queue, epochs).
- [x] 2.4 Extract Diff dressing into `dress.ts` (highlights, outlines, ghosts, fadePlan; ghost residency through the context).
- [x] 2.5 Extract the storey section sweep into `storey-motion.ts` (plane, entries, fades, retarget chain — verbatim semantics).
- [x] 2.6 Extract the labels and plan layers into `labels.ts` (room and dimension labels, plan floor and wall tops, constraint labels).
- [x] 2.7 Extract the revision diff state and changes panel into `diff-mode.ts` (shown diff, base cache, status map, category filter).
- [x] 2.8 Extract the style patches into `style.ts` (plan-style shader tops, stair banding and edges, background and grid).
- [x] 2.9 Tidy the engine: doc comment, dead imports, confirm no tool state remains; update `docs/architecture.md`.

## 3. Acceptance

- [x] 3.1 Re-render both models; every snapshot PNG byte-identical to the before state.
- [x] 3.2 `engine.ts` ≈1,050 lines (814 code), down from 2,681; every `window.__elmstead*` hook unchanged and asserted by the existing suites.
- [x] 3.3 Add fast unit tests for any pure logic the extraction exposes (`lib/storeys.ts`: lowest-first ordering and the cumulative-prefix check).

## 4. Verification

- [x] 4.1 `npm test`, `npm run typecheck`, `npm run format` and `npx openspec validate --all --strict` pass.
