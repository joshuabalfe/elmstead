# Tasks

## 1. Orientation note

- [x] 1.1 Add a header paragraph to `models/elmstead/shared.ts` that maps plan axes to building sides (west front, east rear, north party/left, south end/right, seen from the street) and gives true facings (front ≈ 063°, east-north-east); point `models/elmstead/index.ts`'s orientation note at it; verify it agrees with `northAngle: deg(153)`
- [x] 1.2 Correct the "north and south party walls" prose in `shared.ts` and `attic/walls.ts`: plan north is the party wall, plan south is the exposed end wall, and both are gable ends; verify no prose still calls plan south a party wall

- [x] 1.3 Set `site.northAngle` to `deg(153)` in `models/elmstead/index.ts`, with a comment: measured from a north-up street map of Picton Rd (frontage ≈ 153°/333°, front faces ≈ 063°), about ±2°. Verify the north-up plan shows the front wall facing about 063°, and a plan rendered with `orientation: "project"` shows the north arrow 27° clockwise of the plan's −y.

## 2. Rename ids

- [x] 2.1 Rename the external wall runs and their walls on every storey (`shared.ts`, `*/walls.ts`, `extension.ts`) per design.md's table, renaming `externalRuns` keys and TypeScript identifiers to match; verify `npm run check models/elmstead/index.ts` passes
- [x] 2.2 Rename the internal walls, rooms, doors, windows, slabs and railings per the table (`basement/`, `ground/`, `first/`, `street.ts`), plus compass words in element `name`s; verify `npm run check models/elmstead/index.ts` passes
- [x] 2.3 Rename the constraint ids and update every wall/opening/room reference in `constraints.ts`; reword compass words in notes without changing any distance or attribution; verify all constraints are met with unchanged distances
- [x] 2.4 Update `tests/elmstead.test.ts` to the new ids, including the templated `wall-extension-${side}` ids; verify `npx vitest run tests/elmstead.test.ts` passes

## 3. Comments

- [x] 3.1 Reword compass words in comments across `models/elmstead/` to front/rear/left/right or party/end, or mark them as plan axes where they describe plan-axis code; verify that grepping `models/elmstead` and `tests/elmstead.test.ts` for `north|south|east|west` leaves only plan-axis arguments, `northAngle` and the orientation note

## 4. Verification

- [x] 4.1 Run `npx openspec validate --all`, `npm run typecheck` and `npm test`, and regenerate `out/` with `npm run all models/elmstead/index.ts`; verify all pass and the plan and 3D renders are unchanged apart from labels, ids and the 18° turn from the new `northAngle`
