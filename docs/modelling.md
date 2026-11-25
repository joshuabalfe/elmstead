# Modelling

A model is a TypeScript module in `models/` that default-exports a `BuildingModel`. Start from
[`models/example-cottage/`](../models/example-cottage/), a full working example: an `index.ts` and
its `constraints.ts`.

A larger model splits across more files in its folder, as in
[`models/elmstead/`](../models/elmstead/):

```
models/elmstead/
  index.ts          defineBuilding(...): components, storeys: [basement, street, ground, first]
  constraints.ts    real measurements the model must keep (see Constraints)
  shared.ts         dimensions every floor uses: outline, external wall thicknesses, floor levels
  street.ts         external works: street level, ground slab, front steps and railings
  components/       door and window designs, shared by every floor
    doors.ts        front door, internal door
    windows.ts      front window, fanlight, standard window
    index.ts        the building's `components`
  ground/           one folder per storey
    walls.ts        walls, and the plan positions everything else derives from
    openings.ts     doors and windows: which component, which wall, where, what size, which way it swings
    rooms.ts        room outlines along the wall faces
    index.ts        exports the ground-floor Storey
```

Split a storey by role (walls, openings, rooms), not by room: walls and doors are shared between
rooms, and rooms are outlined from wall faces.

Only `index.ts`'s default export is the model; the other files are ordinary modules it imports.
Pass the folder (`models/elmstead`) to the commands, and outputs are named after it.

```ts
import { defineBuilding, m, mm, pt, rectWalls, door, window } from "../../src/model/index.js";

const walls = rectWalls("wall", pt(mm(0), mm(0)), m(8), m(6), { thickness: mm(200), height: m(2.4) });

export default defineBuilding({
  project: { id: "project-demo", name: "Demo" },
  site: { id: "site-default", name: "Default site" },
  building: { id: "building-demo", name: "Demo" },
  storeys: [{
    id: "storey-ground", name: "Ground floor", elevation: mm(0),
    walls: [walls.south, walls.east, walls.north, walls.west],
    openings: [door("door-front", walls.south, m(3.5), { width: mm(900), height: m(2.1) })],
    slabs: [],
    rooms: [],
  }],
});
```

After every change, run `npm run build` and `npm run render`, and look at the plan PNG.

## Units

| Quantity | Unit | How to write it |
|---|---|---|
| length | integer millimetres, type `Mm` | `mm(200)`, `m(2.4)` (2400 mm) |
| angle | degrees | `deg(90)` |

- A plain `number` is not an `Mm`, so `thickness: 200` is a type error. Use `mm(200)`.
- `mm()` and `m()` throw if the value isn't a whole number of millimetres. For example,
  `m(1.2345)` throws.
- Do arithmetic on `Mm` values with `add`, `sub`, `neg`, `scale` (rounds to the nearest mm),
  `div` (throws unless the result is a whole number) and `divRound`. All are exported from
  `src/model/index.ts`.

## Coordinates

- Each storey has its own 2D plan: **x points east and y points north**, in mm. The example
  cottage puts the origin at the outside south-west corner.
- Heights are measured up from the storey's `elevation`, which is the finished floor level above
  the building's zero.
- The floor structure that carries a storey belongs to that storey, as its slab: the slab's top is
  at the storey elevation and it extends downwards. Above another storey, set the elevation one
  structure thickness above the lower storey's clear ceiling. Stop the lower storey's walls at the
  clear ceiling, so the slab sits on them and its exposed edge is the 200 mm structure band between
  storeys. The lower storey's clear ceiling is then the slab's underside, and a stair rises the
  floor-to-floor distance — ceiling plus structure — not the clear ceiling alone.
- `site.northAngle` (optional) is the angle of true north, counter-clockwise from plan +y. Leave
  it out if north is straight up the plan.

## Ids

- Every element has an `id` in lower-case kebab-case: `^[a-z0-9]+(-[a-z0-9]+)*$`, for example
  `wall-north-1` or `door-front`.
- Ids must be unique across the whole model, including components, and they should not change
  when geometry changes. `check` and `build` report a duplicate against that id.
  The IFC GlobalId is derived from the id, so renaming an element makes it a different element in
  IFC.
- Prefix ids with the element type (`wall-`, `door-`, `window-`, `room-`, `slab-`, `storey-`) so
  that messages and labels are easy to read.

## Elements

| Element | Key fields | Notes |
|---|---|---|
| **Wall** | `start`, `end`, `thickness`, `height`, `justification` | straight; `justification` is `centre`, `left` or `right` |
| **Door** | `wallId`, `offsetAlongWall`, `width`, `height`, `sillHeight`, `swing?`, `doorway?` | `kind: "door"`; a doorway has no leaf, component or swing |
| **Window** | `wallId`, `offsetAlongWall`, `width`, `height`, `sillHeight`, `reveal?` | `kind: "window"` |
| **Slab** | `outline`, `thickness`, `elevationOffset`, `material?` | top of slab is at storey elevation + `elevationOffset`; the slab extends downwards from there; `material: "ground"` renders an external ground slab (default `concrete`) |
| **Room** | `name`, `outline`, `dimensionOutline?` | 2D outline only, for now; `dimensionOutline` optionally gives the part the plan measures, while the label, area and IFC space keep `outline` |
| **Stair** | `toStoreyId`, `segments` | a storey element climbing to the next storey up; `segments` run bottom to top |
| **Stair flight** | `start`, `end`, `width`, `risers` | `kind: "flight"`; a straight run, centred on its start→end line, of at least 2 risers |
| **Stair landing** | `outline`, `thickness` | `kind: "landing"`; a flat platform between flights or at the top of the stair, its level derived from the flights below it |
| **Railing** | `start`, `end`, `height`, `startBase?`, `endBase?` | a straight guard or handrail; `height` is to the top of the rail above the walking surface; an omitted base is 0, equal effective bases are level and different bases slope |
| **Door / window component** | `id`, `name` | a design (not a size) shared by openings, in the building's `components: { doors, windows }`; written to IFC as `IfcDoorType` / `IfcWindowType` |

- Outlines are open polygons: at least three distinct points, no repeated adjacent points, the
  first point is not repeated at the end, the area is non-zero and the outline does not cross
  itself. Concave outlines are fine.
- The schema does not allow unknown fields, so a typo in a field name is a validation error rather
  than being silently ignored.

### Wall justification

`justification` says where the wall body sits relative to the line from `start` to `end`, looking
from `start` towards `end`:

- `centre`: the line runs down the middle of the wall.
- `left`: the body is on the left of the line, so the line is the right-hand face.
- `right`: the body is on the right of the line.

`rectWalls` draws its walls counter-clockwise with `left` justification, so the rectangle you
give it is the **outside** of the building. The south and north walls run the full width, and the
east and west walls fit between them, so the corners neither overlap nor leave gaps.

### Openings

- `offsetAlongWall` is measured along the wall from its `start` to the near edge of the opening.
- `sillHeight` is measured from the storey floor. Doors have `sillHeight: 0`.
- A doorway is a door with `doorway: true`: it opens the wall with no leaf, component or swing. Use the `doorway()` helper.
- An opening must fit inside its wall: `offsetAlongWall + width` may not exceed the wall length,
  and `sillHeight + height` may not exceed the wall height. Two openings on one wall may touch at
  an edge but may not overlap in both directions. The checks report violations before anything is
  written.
- Door `swing` has two fields:
  - `hinge: "start" | "end"`: which jamb the door is hinged on, the one nearer the wall start or
    the one nearer the wall end.
  - `side: "left" | "right"`: which side of the wall the door opens towards, looking from wall
    start to end.

  If it is left out, the default is `{ hinge: "start", side: "left" }`. For the walls `rectWalls`
  makes, `left` is the inside of the building.

#### Splayed reveals

A window's `reveal` angles both jambs out towards one face of the wall, as old houses often do on
the inside to let in more light:

```ts
window("window-living", west, offset, frontWindow, size, { face: "left", angle: deg(45) });
```

- `face` is `left` or `right`, looking from wall start to end, as for door swings.
- `angle` is how far each jamb turns off square, more than 0° and less than 90°.
- The frame is taken to sit in the middle of the wall. From the other face to the middle the
  reveal is square, and `width` is the width there. From the middle to `face` both jambs splay, so
  at that face the opening is wider by `thickness × tan(angle)`: a 1200 mm window in a 400 mm wall
  at 45° is 1600 mm wide on the splayed face.
- The head and sill stay square. Doors have no reveals.
- The splayed face must still fit within the wall and clear the other openings on it.

### Components

A component is a door or window design: "internal door", "sash window". Each opening says which
one it is with `componentId`, so a design is described once and shared, and IFC tools see the
doors and windows as instances of one type.

- The component is the design: how it is built. So far that is its name and, for doors and
  windows, a frame (below); windows can also have glazing bars. Door panels and the like go here
  as they are added.
- The opening holds its size and where it is: width, height, wall, offset, sill height, swing. One
  design comes in many sizes, as windows in an old house do. IFC does the same (`IfcWindow` carries
  its own overall width and height).
- So a component is worth having whenever two openings are built the same way, whatever their
  sizes; a one-off design is a component used once.
- `build` checks that each `componentId` exists and is the right kind (`src/checks/components.ts`),
  and stops before writing anything if not.
- Ids: `door-type-…` and `window-type-…`.

#### Frames and glazing bars

A door component's `frame` divides every door of that design into a frame (jambs and a head, but
no sill) and the leaf inside it:

```ts
// A 1 m opening with a 50 mm frame leaves a 900 mm leaf.
doorComponent("door-type-front", "Front door", { frame: { width: mm(50) } });
```

The opening stays the same size and the leaf shrinks; the two jambs and the head tile the
opening. On the plan the leaf and its swing arc are inset by the frame, and in IFC the frame is
three 70 mm deep white pieces around a 50 mm leaf. `build` checks that the frame leaves room for
a leaf. A window component's `frame` and `glazing` divide every window of that design into frame,
panes and bars:

```ts
// A 100 mm frame, then a bar half way up and three panes across in the ratio 1:2:1: six panes.
windowComponent("window-type-front", "Front window", {
  frame: { width: mm(100) },
  glazing: { columns: [1, 2, 1], rows: [1, 1], barWidth: mm(60) },
});
```

- The frame is the same width all round and lies inside the window's `width` and `height`: the
  opening stays the same size and the glass shrinks.
- `columns` are the pane widths left to right and `rows` the pane heights bottom to top, as
  ratios, so the design fits any size of window. The ratios share out what is left inside the
  frame after the bars.
- In IFC each pane is a glass panel, and the frame and bars are 70 mm deep white pieces standing
  proud of the glass (`src/geometry/window.ts`). None of them overlap.
- On the plan, every frame or bar piece the cut passes through shows as a small block across the
  glazing lines: the jambs and the vertical bars.
- `build` checks that the frame and bars leave room for glass in every window of the design.
- Openings without a `componentId` are still allowed.

```ts
const internalDoor = doorComponent("door-type-internal", "Internal door");
const sash = windowComponent("window-type-sash", "Sash window");

door("door-living", hallWest, offset, internalDoor, { width: mm(800), height: m(2.1) }, { hinge: "start", side: "left" });
window("window-kitchen", ext.north, offset, sash, { width: m(1.2), height: m(1.2), sillHeight: mm(900) });
window("window-landing", ext.north, offset, sash, { width: mm(900), height: m(1.2), sillHeight: mm(900) }); // same design, own size

defineBuilding({ ..., components: { doors: [internalDoor], windows: [sash] }, storeys: [...] });
```

## Stairs

A stair climbs from the storey that holds it to the storey named by `toStoreyId`, which must be the
next one up. Its `segments` run bottom to top, start with a flight, and never put two landings in a
row. A flight is centred on its start→end line, and a landing's outline must meet the end of the
flight before it and, when there is one, the start of the flight after it.

A stair normally ends with a flight. It may instead end with a **top landing** one riser below the
storey above: the last, implicit riser is the storey edge you step onto. The landing then has no
flight after it, so only the flight before it has to meet its outline.

Nothing vertical is stored. The rise comes from the two storeys and the rest follows:

```text
total rise = toStorey.elevation − storey.elevation
riser      = total rise / (the sum of every flight's risers + 1 if a top landing ends the stair)
going      = a flight's plan run / (its risers − 1)
levels     = walk the segments: a flight rises by risers × riser, a landing stays level
```

So a 3050 mm rise over two flights of 8 risers gives 190.625 mm risers, a half landing 1525 mm up,
and a top that lands exactly on the storey above. A stair whose last segment is a landing counts one
more riser: over 1950 mm with six flight risers and a top landing, the riser is 278.571 mm and the
landing sits one riser below the street. Move that storey and the whole stair follows. Derived
lengths are plain numbers rather than the branded integer `Mm`: rounding 190.625 to 191 would put
sixteen risers at 3056 mm, past the storey the stair climbs to.

`models/example-two-storey/index.ts` is a worked half-turn stair:

```ts
const rise = m(3.05); // 3050 mm over 16 risers: 190.625 mm each

const firstFloor: Storey = { id: "storey-first", name: "First floor", elevation: rise, ... };

const lowerFlight = stairFlight("stair-flight-lower", pt(mm(2600), mm(1400)), pt(mm(4400), mm(1400)), { width: mm(800), risers: 8 });
const halfLanding = stairLanding("stair-landing-half", outline, { thickness: mm(150) });
const upperFlight = stairFlight("stair-flight-upper", pt(mm(4400), mm(2200)), pt(mm(2600), mm(2200)), { width: mm(800), risers: 8 });

const ground: Storey = {
  id: "storey-ground", elevation: mm(0), ...,
  stairs: [stair("stair-main", firstFloor, [lowerFlight, halfLanding, upperFlight])],
};
```

The two flights turn through 180°, so the IFC calls the stair `HALF_TURN_STAIR`. Its landing is an
ordinary polygon, so an irregular one — a rear hall wrapping around it, say — needs no special case.
Not modelled yet: winders, curved and spiral stairs, headroom, and openings cut in an upper
floor's slab (shape the slab's outline around the stairwell instead).

## Railings

A railing is a straight run from `start` to `end`. `height` is the top of the rail above the
walking surface; `startBase` and `endBase` give that surface at each end, relative to the storey
floor. An omitted base is 0, so equal effective bases make a level guard and different ones make a
sloped handrail. Posts are derived at both ends and at centres no more than 160 mm apart.

```ts
const levelGuard = railing("railing-front", pt(mm(0), mm(0)), pt(m(3), mm(0)), { height: mm(900) });
const handrail = railing("railing-steps", pt(mm(0), mm(0)), pt(mm(900), mm(0)), { height: mm(900), startBase: mm(150), endBase: mm(600) });
```

Nothing else vertical is stored: the rail follows the two bases and the writer, round-trip and
plan derive the rest. A level rail along the front at street level can continue a step railing
from the bottom of the steps, as `models/elmstead/street.ts` does.

## External works

External ground is a storey below the building's ground floor: give it a negative `elevation`, no
rooms, and a stair climbing to the ground storey. Front steps are then an ordinary stair, and the
ground itself is a wide, thin slab with `material: "ground"`.

```ts
const streetLevel: Storey = {
  id: "storey-street",
  name: "Street level",
  elevation: mm(-450),
  walls: [],
  openings: [],
  slabs: [{ id: "slab-ground-external", name: "External ground", outline, thickness: mm(50), elevationOffset: mm(0), material: "ground" }],
  rooms: [],
  stairs: [stair("stair-front", ground, [stairFlight("stair-flight-front", bottom, top, { width: m(1.2), risers: 3 })])],
};
```

The stair derives its rise and risers from the two storeys, so the steps follow if the street level
changes. Keep the ground slab a few metres beyond the building — and outside the footprint when a
basement is planned, because it cannot extend underneath. Walls start at their storey's floor, so
the wall base needs a basement storey (as elmstead has) or a plinth to close the face below it.
Snapshots frame on everything shown, and a site-wide slab shrinks the house in the picture.

## Helpers

All of these are in `src/model/helpers.ts` and exported from `src/model/index.ts`. They only
build plain values, so a model can always write the JSON shape out directly instead.

| Helper | What it does |
|---|---|
| `defineBuilding(b)` | fills in `schemaVersion` and type-checks the whole model |
| `pt(x, y)` | a plan point |
| `wall(id, start, end, { thickness, height, justification?, name? })` | a wall, `centre`-justified by default |
| `rectWalls(prefix, origin, width, depth, { thickness, height })` | four external walls `<prefix>-south/east/north/west` whose outer faces form the rectangle |
| `face(wall, "north" \| "south" \| "east" \| "west")` | the coordinate of one face of an axis-aligned wall |
| `rectRoom(id, name, { west, east, south, north })` | a rectangular room outline |
| `centredOn(wall, at, width)` | the `offsetAlongWall` that centres an opening of `width` on plan coordinate `at` |
| `doorComponent(id, name, { frame? })`, `windowComponent(id, name, { frame?, glazing? })` | a door or window design for `components` |
| `door(id, wall, offset, component?, { width, height }, swing?)` | a door, with `sillHeight` 0, linked to the component if given one |
| `doorway(id, wall, offset, { width, height })` | a plain doorway: no leaf, frame or swing |
| `window(id, wall, offset, component?, { width, height, sillHeight }, reveal?)` | a window, linked to the component if given one, with splayed jambs if given a reveal |
| `faceCrossing(wall, "left" \| "right", "x" \| "y", at)` | where a face of a wall at any angle crosses the line x = `at` or y = `at`: room corners against diagonal walls |
| `stairFlight(id, start, end, { width, risers })` | a straight flight of steps, for `stair()` |
| `stairLanding(id, outline, { thickness })` | a flat platform between flights, for `stair()` |
| `stair(id, toStorey, segments)` | a stair to `toStorey`, recording its id as `toStoreyId`; segments run bottom to top |
| `railing(id, start, end, { height, startBase?, endBase? })` | a straight guard or handrail; bases are recorded as given and an omitted base means 0 |

### Make dimensions follow each other

The example cottage derives its geometry rather than hard-coding coordinates:

- Room outlines come from `face()` of the walls around them, so changing a wall's thickness
  resizes its rooms.
- Windows are positioned with `centredOn(wall, middleOfRoom, windowW)`, so they stay centred when
  the room or the window width changes.
- Shared sizes are named once at the top of the file (`extWallT`, `windowW`, `intDoor`, and so
  on).

For example, changing `extWallT` from 200 to 300 thickens every external wall, shrinks every room
and keeps every window centred. The JSON diff is about 40 lines.

## Constraints

A constraint records a real measurement, such as "the living-room window starts 1175 mm from the
inside corner", so that no later edit can quietly break it. Every `check`, `build`, `render` and
`all` measures the model's constraints. If one is broken, the command writes nothing and exits 1:

```
constr  models/example-cottage/constraints.ts: 5 of 6 met
ERROR   living-corner-to-window: is 1200 mm, should be 1175 ±10 mm (room-living)
```

**When a constraint fails, fix the model, not the constraint.** Change or add a constraint only
for a new measurement, and say where it came from in its `note`. Don't record positions traced
from a drawing as constraints.

The **Constraints** button (off by default) shows each constraint in red at the midpoint of its
measured span, labelled with its id and required distance, with a thick red dotted line along the
span. `build` resolves the points into `out/<name>.constraints.json` for the viewer; that file is
generated, so don't edit it.

### Where they live

Constraints sit beside the model, not in it, and never reach `building.json` or the IFC:

- a folder model: `constraints.ts` in its folder, e.g. `models/elmstead/constraints.ts`;
- a single-file model: `<name>.constraints.ts` beside it.

The file default-exports groups of constraints, each for one storey or one room. A model without
a constraints file has no constraints, and the commands print no `constr` line.

```ts
import { corner, defineConstraints, inRoom, jamb, mm, roomCorner } from "../../src/constraints/index.js";

export default defineConstraints([
  inRoom("room-living", [
    {
      id: "living-corner-to-window",
      note: "Inside south-west corner to the window's west jamb, along the front wall",
      from: corner({ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" }),
      to: jamb("window-living", "start", "left"),
      measure: { along: "wall-south" },
      distance: mm(1175),
    },
    { id: "living-width", from: roomCorner("south-west"), to: roomCorner("north-east"), measure: "x", distance: mm(3550) },
  ]),
]);
```

[`models/example-cottage/constraints.ts`](../models/example-cottage/constraints.ts) uses every
kind of point and measure.

### Points

Points are named from model ids, never coordinates, so they move with the model. A point that
names an id the model no longer has is an ERROR, so renaming an element shows up straight away.

| Helper | The point |
|---|---|
| `corner({ wall, face }, { wall, face })` | where the lines of two wall faces cross: an inside or outside corner |
| `wallEnd(wall, "start" \| "end", face?)` | one end of a wall, on its start→end line or on `face` |
| `jamb(opening, "start" \| "end" \| "centre", face?)` | an opening's jamb nearest the wall start, its far jamb, or half way between, on the wall line or on `face` |
| `roomCorner(room?, "south-west" \| … \| n)` | the room outline vertex furthest in that direction, or vertex `n` from 0. Inside `inRoom` the room can be left out |

Each helper takes an id or the model object (e.g. a `Wall` imported from the model's modules).

A **face** is `left` or `right`, looking from the wall's start to its end, or a compass side
(`north`, `south`, `east`, `west`) of a wall running along plan x or y. Diagonal walls only have
`left` and `right`.

On the face a window's [reveal](#splayed-reveals) splays to, its `start` and `end` jambs are where
the reveal meets that face, as a tape in the room finds them: a 1200 mm window splayed 45° in a
400 mm wall measures 1600 mm jamb to jamb on its splayed face and 1200 mm on the other. Its
`centre`, and jambs on the wall line, do not move.

Prefer wall-face corners to room corners for anything structural: room outlines are themselves
drawn from wall faces, and a vertex number changes when an outline gains a point.

### Measures and tolerance

| `measure` | The distance |
|---|---|
| `"straight"` | straight-line distance |
| `"x"`, `"y"` | difference in plan x or y |
| `{ along: wallId }` | the distance projected onto that wall's direction, as a tape along the wall reads it |

Distances are unsigned and measured in plan only; heights can't be constrained yet. The measured
distance is rounded to the nearest mm, and the constraint is met when that is within `tolerance`
of `distance`. The tolerance defaults to 10 mm.

Every point, and the wall measured along, must be on the group's storey (for a room group, the
room's storey).

## Things the schema does not have yet

Room heights (rooms are 2D outlines in IFC), wall types (external or internal), roofs, curved walls,
winder and spiral stairs. Don't approximate these with the existing types. Propose a
schema change instead (see [Development](development.md#adding-a-new-element-type)).
