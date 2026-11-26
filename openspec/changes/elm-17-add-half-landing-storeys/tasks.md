# Tasks

The model and test work landed on this branch before the change was written (commits 839d3f1,
fe69535 and 4eff619), so those tasks are already done.

## 1. Attic stair

- [x] 1.1 Add elmstead's attic stair, 8 + 8 risers (owner) with a half landing inside the core, over the main stair; verify `npm run build models/elmstead/index.ts` passes with every constraint met

## 2. Half-landing storeys

- [x] 2.1 Derive each half landing's elevation from the lower flight's share of the rise in `models/elmstead/shared.ts`; verify the stair tests derive 9 + 8 and 8 + 8 risers that land on each storey
- [x] 2.2 Make both half landings storeys, split each stair at its landing, and add the wall at the back of the attic half landing; verify the attic-stair tests in `tests/elmstead.test.ts` pass
- [x] 2.3 Update the floor-structure and viewer storey-stepping tests for the new storeys; verify `tests/elmstead.test.ts` and `tests/plan-vs-3d.test.ts` pass

## 3. Split-level extension

- [x] 3.1 Move the extension walls above the main half landing onto the half-landing storeys (`models/elmstead/extension.ts`), split the ground north wall at the core and drop the first-floor extension slab bands; verify the extension-stacking and roof-taper tests pass
- [x] 3.2 Lower the rear-hall window to fit under the main half landing and point the rear-hall depth constraint at `wall-north-extension`; verify all constraints are met
- [x] 3.3 Skip storeys whose walls span less than 2 m in the plan-versus-3D comparison, per the `ifc-viewer` delta; verify `tests/plan-vs-3d.test.ts` passes

## 4. Documentation

- [ ] 4.1 Add a "Half-landing storeys" section to `docs/modelling.md` beside the stairs and external-storey sections: when to use a landing segment and when to use a storey, how to derive the landing's elevation, splitting the stair, and split-level walls; verify every model call it shows matches the helpers in `src/model/`
- [ ] 4.2 Note in `docs/development.md`, where it describes `tests/plan-vs-3d.test.ts`, that storeys whose walls span less than 2 m are skipped; verify the wording matches the test's rule

## 5. Verification

- [ ] 5.1 Run `npx openspec validate --all`, `npm run typecheck` and `npm test`, and regenerate `out/` with `npm run all models/elmstead/index.ts`; verify all pass

## Workflow follow-up

- Sync the delta specs and archive the change once the pull request is reviewed.
