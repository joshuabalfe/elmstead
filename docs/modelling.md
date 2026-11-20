# Modelling

A model is a TypeScript file in `models/` that default-exports a `BuildingModel`. Start from
[`models/example-cottage.ts`](../models/example-cottage.ts), which is a full working example.

A larger model can be a folder whose `index.ts` default-exports the building, as in
[`models/elmstead/`](../models/elmstead/):

```
models/elmstead/
  index.ts     defineBuilding(...), storeys: [ground, ...]
  shared.ts    dimensions every floor uses: outline, external wall thicknesses, floor levels
  ground.ts    exports the ground-floor Storey
```

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
- Ids must be unique across the whole model, and they should not change when geometry changes.
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

- Outlines are open polygons: at least three points, and the first point is not repeated.
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
- Door `swing` has two fields:
  - `hinge: "start" | "end"`: which jamb the door is hinged on, the one nearer the wall start or
    the one nearer the wall end.
  - `side: "left" | "right"`: which side of the wall the door opens towards, looking from wall
    start to end.

  If it is left out, the default is `{ hinge: "start", side: "left" }`. For the walls `rectWalls`
  makes, `left` is the inside of the building.

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
| `door(id, wall, offset, { width, height }, swing?)` | a door, with `sillHeight` 0 |
| `window(id, wall, offset, { width, height, sillHeight })` | a window |

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
