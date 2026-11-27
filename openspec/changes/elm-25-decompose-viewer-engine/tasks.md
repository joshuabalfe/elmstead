# Tasks

## 1. Before state

- [ ] 1.1 Render `models/elmstead` and `models/examples/example-cottage`; record the snapshot PNG sha256 hashes.

## 2. Staged extraction (each stage: typecheck + full viewer suites + npm test)

- [ ] 2.1 Add `src/frontend/scene/context.ts` (types-only SceneContext) and extract the measurement tool into `measure.ts`; engine implements the context and wires the tool's API.
- [ ] 2.2 Extract walk mode into `walk.ts` (savedView, pointer lock, keys, rAF, entry/exit refresh through the context).
- [ ] 2.3 Extract hover identification into `identify.ts` (labels map, hover sprite, pick queue, epochs).
- [ ] 2.4 Extract Diff dressing into `dress.ts` (highlights, outlines, ghosts, fadePlan; ghost residency through the context).
- [ ] 2.5 Extract the storey section sweep into `storey-motion.ts` (plane, entries, fades, retarget chain — verbatim semantics).
- [ ] 2.6 Tidy the engine: doc comment, dead imports, confirm no tool state remains; update `docs/architecture.md`.

## 3. Acceptance

- [ ] 3.1 Re-render both models; every snapshot PNG byte-identical to the before state.
- [ ] 3.2 `engine.ts` ≤ ~1,000 lines; every `window.__elmstead*` hook unchanged and asserted by the existing suites.
- [ ] 3.3 Add fast unit tests for any pure logic the extraction exposes (fade states, pick queue ordering).

## 4. Verification

- [ ] 4.1 `npm test`, `npm run typecheck`, `npm run format` and `npx openspec validate --all --strict` pass.
