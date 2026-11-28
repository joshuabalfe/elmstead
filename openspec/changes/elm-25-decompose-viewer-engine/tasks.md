# Tasks

## 1. Before state

- [x] 1.1 Render `models/elmstead` and `models/examples/example-cottage`; record the snapshot PNG sha256 hashes.

## 2. Staged extraction (each stage: typecheck + full viewer suites + npm test)

- [x] 2.1 Add `src/frontend/scene/context.ts` (SceneContext: types plus the shared FADE constant) and extract the measurement tool into `measure.ts`; engine implements the context and wires the tool's API.
- [x] 2.2 Extract walk mode into `walk.ts` (free-fly pose, pointer lock, keys, rAF, entry/exit refresh through the context).
- [x] 2.3 Extract hover identification into `identify.ts` (labels map, hover sprite, pick queue, epochs).
- [x] 2.4 Extract Diff dressing into `dress.ts` (highlights, outlines, ghosts, fadePlan; ghost residency through the context).
- [x] 2.5 Extract the storey section sweep into `storey-motion.ts` (plane, entries, fades, retarget chain — verbatim semantics).
- [x] 2.6 Extract the labels and plan layers into `labels.ts` (room and dimension labels, plan floor and wall tops, constraint labels).
- [x] 2.7 Extract the revision diff state and changes panel into `diff-mode.ts` (shown diff, base cache, status map, category filter).
- [x] 2.8 Extract the style patches into `style.ts` (plan-style shader tops, stair banding and edges, background and grid).
- [x] 2.9 Tidy the engine: doc comment, dead imports, confirm no tool state remains; update `docs/architecture.md`.

## 3. Acceptance

- [x] 3.1 Re-render both models; every snapshot PNG byte-identical to the before state.
- [x] 3.2 `engine.ts` ≈1,050 lines (814 code), down from 2,649; every `window.__elmstead*` hook unchanged and asserted by the existing suites.
- [x] 3.3 Add fast unit tests for any pure logic the extraction exposes (`lib/storeys.ts`: lowest-first ordering, the cumulative-prefix check and `storeyTop`).

## 4. Verification

- [x] 4.1 `npm test`, `npm run typecheck`, `npm run format` and `npx openspec validate --all --strict` pass.

## Verification record

sha256 of the 18 snapshot/plan PNGs for `models/elmstead` and `models/examples/example-cottage`,
recorded before the refactor and re-checked after the implementation and after each sibling merge
(#82, #83). Every file matched on every run (`shasum -a 256 -c`):

```
31f5d2d02eeda83a349fa31c76478f0650bf29e7642d18638e4b510df9bb76de  out/elmstead.3d-ne.png
759db31ba49620d376fd8d038ca42925ba8c64cad9296c9acb5fd725c5072fbc  out/elmstead.3d-nw.png
c098939aca16d0e6d862afee67d972265568208c2c0eab38356debda02ae54ad  out/elmstead.3d-se.png
b000c9b045815f8f05770fd605a3b3b36b662fc7accff2e5f6b0afec9e9f46ca  out/elmstead.3d-sw.png
945d2e55268d81f376d1b823d760482a64ad8aabb605b3957c3fa4602a2c24e9  out/elmstead.3d-top.png
a93b44f500d47aa09a4fe7f07e46e8dedf085863fa0006b294216788b9791aa1  out/example-cottage.3d-ne.png
7405e65a0cfe7653c7d9a89590a12989dd2161dbbab284ba37beacd28d4655cc  out/example-cottage.3d-nw.png
cc6eef910df8996de3d03364d37fdfde33b0563024c7f17dc65bb3f1cd025ced  out/example-cottage.3d-se.png
336360b0d963430b52b7517d602a84336c7f564d5c851fb7fb5aaa8f7f3efce0  out/example-cottage.3d-sw.png
324a1bdb6a811c6b2268072b6cf658e15cc16b562db01a2769cb6448cecadd19  out/example-cottage.3d-top.png
e0f13eea55e88164a3210a158ecd089ecb98fd744aafd1d754b89dd55cadb341  out/elmstead.storey-attic-half-landing.plan.png
a9322aa7bd27512357e39a314354b260f03f7c2a8f653f3f8fb3dba53b2a4b43  out/elmstead.storey-attic.plan.png
7cbed1ae43ddf0c0e17724f85b454649c2c914f2939e200818dfa1aa4221663b  out/elmstead.storey-basement.plan.png
86798d2c048785ccab4cfe4a4ad7a4d6bc44944ddd64dd0ae5df6cd2a84bfd30  out/elmstead.storey-first-floor.plan.png
50c5aee2cc777ee39d391b3d83456a9aaf2142a11e2588654f8e4627cf0a6ff1  out/elmstead.storey-ground.plan.png
4f020df13c9a05173313bd94abbdaeda39ec847d6b250368009dbbc352e47896  out/elmstead.storey-main-half-landing.plan.png
7707032162d89c225f9c9992f643884eac0d6c539e46706395e2575ca6e5996d  out/elmstead.storey-street.plan.png
69359de81d5193ce24416270e2ab20f2657f5e213eda79d45b4aba2e055975b5  out/example-cottage.storey-ground.plan.png
```
