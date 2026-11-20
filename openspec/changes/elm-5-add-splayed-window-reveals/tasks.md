# Tasks

## 1. Schema and authoring

- [x] 1.1 Add `RevealSchema` (`{ face: left|right, angle }`, angle `z.number().gt(0).lt(90).brand<"Deg">()`) and an optional `reveal` on `WindowSchema` only, then run `npm run schema`. Verify with schema tests: a 45° reveal passes; angles 0, 90 and −10 fail; a misspelt reveal field fails; a door with a reveal fails; and the regenerated `building.schema.json` shows the angle's `exclusiveMinimum` 0 and `exclusiveMaximum` 90.
- [x] 1.2 Give `window()` in `src/model/helpers.ts` an optional reveal as its last argument, in both overloads, leaving the field out when none is given. Verify with helper tests for a window with and without a reveal.
- [x] 1.3 Document reveals in `docs/modelling.md`: the face, the angle, the width being in the middle, and the splay starting at the middle. Verify the example type-checks against the helper.

## 2. Opening geometry

- [x] 2.1 Add `src/geometry/opening.ts` with `revealSplay(wall, window)` and `openingOutline(wall, opening, clearance = 0)` in wall (along, across) coordinates: four points for a square opening, six for a splayed one, with clearance carrying the face lines out and the splayed jambs along their own lines, and a square opening's points in `wallSegmentFootprint`'s order. Verify with unit tests: a 1200 mm window in a 400 mm centre wall at 45° is 1200 wide at the square face and 1600 at the splayed face; left and right faces on left-, right- and centre-justified walls; 10 mm clearance; and a square opening's outline equal to `wallSegmentFootprint`.

## 3. Checks

- [x] 3.1 Extend `checkOpenings` in `src/checks/model.ts` so a splayed window fits at its splayed face ("opening is N mm past the wall start" or "past the wall end"), and two openings overlap when their intervals overlap at either face as well as vertically. Verify with check tests for each new scenario in `specs/model-checks/spec.md`, and that the existing opening tests still pass unchanged.

## 4. IFC

- [x] 4.1 In `src/ifc/writer.ts`, void a splayed window with an `IfcArbitraryClosedProfileDef` of its `openingOutline` with 10 mm clearance, shifted back by `offsetAlongWall` to the opening's placement and extruded as now, and keep the `IfcRectangleProfileDef` for every other opening. Verify with IFC tests: a splayed fixture's opening profile has six points at the expected coordinates and passes the IfcOpenShell validation; and a window without a reveal still has a rectangle profile.
- [x] 4.2 In `src/ifc/roundtrip.ts`, expect each wall to lose its openings' plan area within the wall (`width × thickness + splay × thickness / 2`) × height. Verify with round-trip tests: the splayed fixture builds with no round-trip ERROR, and an IFC written with a square void for a splayed window reports the wall's volume ERROR.
- [x] 4.3 Note in `docs/ifc.md` how a splayed reveal is written and what the round-trip expects. Verify the doc names `IfcArbitraryClosedProfileDef`, the 10 mm clearance and the expected wall volume.

## 5. Plans

- [x] 5.1 In `src/render/plan.ts`, end wall pieces on a splayed opening's outline, and draw `drawWindow`'s outline and `drawUncut`'s dashed outline from `openingOutline`. Verify with render tests: a splayed fixture's wall pieces have five points with one splayed end and six with two, and its window outline has six points; and the example cottage's SVG snapshot is unchanged.
- [x] 5.2 Note splayed reveals in `docs/rendering.md`. Verify the doc describes the angled wall ends.

## 6. Constraints

- [x] 6.1 In `src/constraints/resolve.ts`, move an opening point's `start` and `end` out by the splay when its face is the reveal's face, and leave `centre`, the other face and no face unchanged. Verify with constraint tests for the splayed-jamb and square-face scenarios, and that every existing constraint test passes unchanged.
- [x] 6.2 Mention splayed jambs in the Constraints section of `docs/modelling.md`. Verify the text matches the spec scenario: 1600 on the splayed face, 1200 on the other.

## 7. Elmstead

- [x] 7.1 Give `window-living` in `models/elmstead/ground/openings.ts` a reveal of `{ face: "left", angle: deg(45) }`, with a comment that the inside returns are at about 45° and the frame is taken as the middle of the wall. Verify that `npm run all models/elmstead` passes with `constr … 2 of 2 met`, with no round-trip ERROR for `wall-west`, that the ground plan shows the splayed returns, and that the 3D snapshots show them too.

## 8. Integration

- [ ] 8.1 Run `npm test` (including `tests/plan-vs-3d.test.ts`, which checks the wall tops still match the plan), `npm run typecheck` and `npx openspec validate --all --strict`. Build the example cottage on this branch and on main and confirm its JSON, IFC and SVG are byte-identical and that only Elmstead's outputs change.
