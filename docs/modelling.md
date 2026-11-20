# Modelling

A model is a TypeScript file in `models/` that default-exports a `BuildingModel`. Start from
[`models/example-cottage.ts`](../models/example-cottage.ts), which is a full working example.

A larger model can be a folder whose `index.ts` default-exports the building, as in
[`models/elmstead/`](../models/elmstead/):

```
models/elmstead/
  index.ts          defineBuilding(...): components, storeys: [ground, ...]
  shared.ts         dimensions every floor uses: outline, external wall thicknesses, floor levels
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
import { defineBuilding, m, mm, pt, rectWalls, door, window } from "../src/model/index.js";

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
| **Door** | `wallId`, `offsetAlongWall`, `width`, `height`, `sillHeight`, `swing?` | `kind: "door"` |
| **Window** | `wallId`, `offsetAlongWall`, `width`, `height`, `sillHeight` | `kind: "window"` |
| **Slab** | `outline`, `thickness`, `elevationOffset` | top of slab is at storey elevation + `elevationOffset`; the slab extends downwards from there |
| **Room** | `name`, `outline` | 2D outline only, for now |
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

### Components

A component is a door or window design: "internal door", "sash window". Each opening says which
one it is with `componentId`, so a design is described once and shared, and IFC tools see the
doors and windows as instances of one type.

- The component is the design: how it is built. So far that is its name and, for windows, a frame
  and glazing bars (below). Door panels and the like go here as they are added.
- The opening holds its size and where it is: width, height, wall, offset, sill height, swing. One
  design comes in many sizes, as windows in an old house do. IFC does the same (`IfcWindow` carries
  its own overall width and height).
- So a component is worth having whenever two openings are built the same way, whatever their
  sizes; a one-off design is a component used once.
- `build` checks that each `componentId` exists and is the right kind (`src/checks/components.ts`),
  and stops before writing anything if not.
- Ids: `door-type-…` and `window-type-…`.

#### Frames and glazing bars

A window component's `frame` and `glazing` divide every window of that design into frame, panes
and bars:

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
| `doorComponent(id, name)`, `windowComponent(id, name)` | a door or window design for `components` |
| `door(id, wall, offset, component?, { width, height }, swing?)` | a door, with `sillHeight` 0, linked to the component if given one |
| `window(id, wall, offset, component?, { width, height, sillHeight })` | a window, linked to the component if given one |
| `faceCrossing(wall, "left" \| "right", "x" \| "y", at)` | where a face of a wall at any angle crosses the line x = `at` or y = `at`: room corners against diagonal walls |

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

## Things the schema does not have yet

Room heights (rooms are 2D outlines in IFC), wall types (external or internal), stairs, roofs and
curved walls. Don't approximate these with the existing types. Propose a schema change instead
(see [Development](development.md#adding-a-new-element-type)).
