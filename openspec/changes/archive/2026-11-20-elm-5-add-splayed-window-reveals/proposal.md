# Proposal

## Why

Every opening is a square-sided hole through its wall. Real windows often have splayed reveals: the
jambs angle out towards the room so more light comes in. Elmstead's front window is one, with
returns at about 45° on the inside. The model can't say so, so its IFC, plans and 3D views show
square reveals, and a jamb measured on the plaster can't be checked against the model.

## What Changes

- A window MAY have a `reveal` of `{ face: left|right, angle }`. Both jambs splay at `angle` degrees
  off square towards the named wall face, from the middle of the wall to that face. The head and
  sill stay square, and so does the reveal from the middle to the other face.
- The window's `width` stays the width at the frame, in the middle of the wall. At the splayed face
  the opening is wider by twice half the wall thickness × tan(angle).
- The schema accepts an `angle` more than 0° and less than 90°.
- Model checks: a splayed opening SHALL still fit within its wall at the splayed face, and SHALL
  NOT overlap another opening there.
- IFC: a splayed window's `IfcOpeningElement` is its plan outline, square on one side and splayed on
  the other, extruded up its height. A window without a reveal is written exactly as now. The
  build's round-trip check expects the wall to lose that larger volume.
- Plans: walls are cut to the splayed outline, and the window symbol and the dashed outline of an
  uncut window follow it.
- Constraints: an opening point on the splayed face lands on the splayed jamb, where the reveal
  meets the face. That is what a tape measure in the room finds.
- `window()` takes an optional reveal, as `door()` takes a swing.
- Elmstead's front window gets a 45° reveal on the inside face.

Doors, splayed heads and sills, and setting where the frame sits in the wall are out of scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `building-schema`: windows gain an optional `reveal`, with its angle range and geometry.
- `model-checks`: a splayed opening must fit within its wall and clear other openings at the
  splayed face.
- `ifc-export`: a splayed window's opening is voided with its splayed outline.
- `ifc-verification`: the round-trip expects a wall to lose a splayed opening's larger volume.
- `plan-rendering`: walls, window symbols and uncut outlines follow a splayed reveal.
- `model-constraints`: an opening point on the splayed face resolves to the splayed jamb.
- `model-authoring`: `window()` takes an optional reveal.

## Impact

- `src/schema/schema.ts`, `schema/building.schema.json` (regenerated).
- A new `src/geometry/opening.ts` for the opening's plan outline, shared by the IFC writer, plans,
  checks and constraints.
- `src/ifc/writer.ts`, `src/ifc/roundtrip.ts`, `src/render/plan.ts`, `src/checks/model.ts`,
  `src/constraints/resolve.ts`, `src/model/helpers.ts`.
- `models/elmstead/ground/openings.ts`: its IFC, plans and 3D snapshots change. The example
  cottage, and its plan snapshot, do not.
- Docs: `docs/modelling.md`, `docs/ifc.md`, `docs/rendering.md`.
