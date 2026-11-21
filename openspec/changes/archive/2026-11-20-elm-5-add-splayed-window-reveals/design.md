# Design

## Context

An opening is a box today, and each consumer builds it on its own:

- the IFC writer extrudes an `IfcRectangleProfileDef` the opening's width by the wall's thickness
  plus 10 mm clearance each side (`src/ifc/writer.ts`, `opening()`);
- the plan cuts square gaps with `wallSegmentFootprint` (`src/render/plan.ts`, `wallPieces`,
  `drawWindow`, `drawUncut`);
- the checks compare `[offsetAlongWall, offsetAlongWall + width]` intervals (`src/checks/model.ts`,
  `checkOpenings`);
- constraints put jambs at those same two distances (`src/constraints/resolve.ts`);
- the build's round-trip expects each wall to lose `width × height × thickness` per opening
  (`src/ifc/roundtrip.ts`).

The window filling already sits in the middle of the wall (`mid` in the writer and the plan), which
is where the reveal's square part meets its splay. The viewer and 3D snapshots mesh the IFC, so its
sides follow the IFC. Its wall tops are the plan's own walls laid over the top
(`renderWallTops`), so they follow the plan.

## Goals / Non-Goals

**Goals:**
- One definition of a splayed opening's plan outline, used by the IFC, plans, checks and constraints.
- Models without reveals give byte-identical JSON, IFC and SVG.

**Non-Goals:**
- Splayed doors, heads or sills; reveals that differ jamb to jamb.
- Moving the frame within the wall. The splay always starts at the middle.
- A reveal on the window component. A reveal is how the wall is built around the window, not part
  of the window's design, so it belongs on the opening.

## Decisions

**Reveal on the window, as `{ face, angle }`.** `face` uses the same `left`/`right` as door swings
and wall faces, so it means the same thing everywhere. An angle rather than a splay width, because
the angle is what you see and measure on site, and a splay width would have to change whenever the
wall's thickness did. Its angle is `z.number().gt(0).lt(90).brand<"Deg">()`, so a bad angle is a schema error that
names the window, not a model check. It is also exported to `building.schema.json` as
`exclusiveMinimum`/`exclusiveMaximum`, which a `.refine` on `DegSchema` would not be.

Alternative: `splay` in mm per jamb. Rejected for the reason above.

**One outline function in `src/geometry/opening.ts`.** `openingOutline(wall, opening, clearance = 0)`
returns the opening's plan polygon in wall coordinates (along, across): four points for a square
opening, six for a splayed one. These are the square face corners, the two points where the jambs
reach the middle, and the splayed face corners. A square opening's four points are in
`wallSegmentFootprint`'s order (right face from start to end, then left face from end to start),
and a splayed one keeps that order with the two middle points inserted, so square openings draw the
same SVG as now. Each splayed jamb moves out by `splay = (|left −
right| / 2) · tan(angle)` at the face. Clearance carries a face line outward and the splayed jambs
along their own lines, so the IFC void still extends 10 mm past each face. A `revealSplay(wall,
window)` helper gives `splay`, which is 0 without a reveal, for the checks, constraints and
round-trip.

Alternative: each consumer computes its own geometry. Rejected, because four copies of the same
trigonometry would drift apart.

**IFC: an `IfcArbitraryClosedProfileDef` only when there is a reveal.** A splayed window's
`IfcOpeningElement` body is its outline, with clearance, extruded up its height, under the same
placement as now. That placement is at `offsetAlongWall`, so the writer shifts the outline back by
the offset before writing it, as the rectangle is now centred at `width / 2`. A window without a reveal keeps its `IfcRectangleProfileDef`, so existing IFC stays
byte-identical, as the ifc-export spec requires. GlobalIds and `OverallWidth` (the frame width) do
not change. The `IfcWindow` filling still sits in the middle, inside the square part.

**Plan: wall pieces end on the outline.** `wallPieces` keeps splitting the wall into stretches
between cuts. Each end of a stretch at a splayed opening gains a point: square from the other face
to the middle, then along the splayed jamb to the face. A stretch has four points, five with one
splayed end, or six with two. `drawWindow` and
`drawUncut` draw `openingOutline` instead of `wallSegmentFootprint`, and the glazing lines and bars
stay as they are. For a square opening the outline is the same four points in the same order, so the
SVG does not change.

**Round-trip: the wall loses the outline's area.** `roundTripChecks` expects each opening to cut
its plan area within the wall (no clearance) × its height: `width × thickness + splay × thickness /
2`. For a square opening that is `width × thickness`, as now. This is the check that catches an IFC
void that doesn't match the outline.

**Checks: compare intervals at each face.** On each half of the wall, an opening covers an interval
along the wall that is widest at the face. That interval is `[offset − splay, offset + width +
splay]` on its splayed half, and `[offset, offset + width]` on the other. Two openings on one half
overlap in plan exactly when their intervals at that face overlap, because their outlines only widen
towards the face. So the overlap check tests both faces' intervals, alongside the vertical test it
already does. The fit check tests the splayed face's interval against `[0, length]`. That adds an
ERROR "opening is N mm past the wall start" next to the current "past the wall end".

**Constraints: splayed jambs only on the named splayed face.** In `resolvePoint`, an opening point
whose `face` is the reveal's face moves `start` back and `end` forward by `splay`, and `centre`
stays where it is. A point on the other face, or with no face, is unchanged, so every existing
constraint measures the same. Elmstead's constraints have no face, so `front-window-width` still
measures the frame width of 2500.

**Elmstead.** `window-living` gets `{ face: "left", angle: deg(45) }`, and the west wall's `left` is
inside. The wall is 450 mm, so each jamb moves 225 mm and the window is 2950 mm wide on the plaster.
It runs 2775–5275 mm along the 6800 mm wall, so the splay runs 2550–5500 mm, clear of the front door (50–950 mm) and the wall's end. The example cottage stays square, so
its plan snapshot and IFC don't change, and the reveal is tested with its own fixtures.

## Risks / Trade-offs

- [The IFC void and the plan disagree about the splay] → `tests/plan-vs-3d.test.ts` can't catch
  this, because the Top view's wall tops are drawn by the plan code itself. The round-trip volume
  check catches it instead: `build` fails if the IFC wall doesn't lose exactly the outline's volume.
  Both the writer and the round-trip use `openingOutline` and `revealSplay`.
- [Splayed outline on a justified wall whose start–end line is the splayed face] → An opening point
  with no face stays at `offsetAlongWall` on that line, not on the splayed jamb. The rule is simple
  and documented, and naming the face gives the splayed jamb.
- [Steep angles make very wide reveals] → The fit and overlap checks catch any reveal that runs past
  the wall or into another opening. Below 90° nothing else limits it.
