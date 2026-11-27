# Tasks

## 1. Before state

- [ ] 1.1 Build every model and revision (`models/elmstead`, `models/examples/example-cottage` and its `rear-extension`); record the JSON, IFC, diff and plan SVG sha256 hashes.

## 2. The table

- [ ] 2.1 Add `src/shared/schema/kinds.ts`: storey collections → schema, kind function, stair-segment children; component collections; derive `STOREY_COLLECTIONS`/`StoreyCollection` from it with the `StoreyArrayKey` completeness constraint.
- [ ] 2.2 Rewrite `idNodes` to walk the table, preserving node order (project/site/building, storey, collections in order, stair segments nested, components last).
- [ ] 2.3 Derive `revise.ts`'s `SCHEMAS` from the table.
- [ ] 2.4 Derive the diff's `COMPARED` and the storey `signature` strip from the table.
- [ ] 2.5 Replace the viewer `storeyItemsOf` owner map with `storeyIndex(modelJson)`.

## 3. Tests

- [ ] 3.1 Add a structural test: the table covers every storey array key, and `idNodes` yields a frozen fixture's nodes in the exact order (kind, id, storey, place).
- [ ] 3.2 Add a diff test: a revision changing one element of every storey kind lists each as changed (the new spec scenario).
- [ ] 3.3 Existing ids/revise/diff/checks/viewer suites pass without assertion changes.

## 4. Acceptance and docs

- [ ] 4.1 Rebuild every model and revision; compare all hashes with the before state — byte-identical.
- [ ] 4.2 Update `docs/development.md`'s "Adding a new element type" checklist (plumbing steps collapse into the table entry) and `docs/architecture.md`'s module layout.
- [ ] 4.3 `npm test`, `npm run typecheck`, `npm run format` and `npx openspec validate --all --strict` pass.
