# IFC output

`npm run build` writes `out/<name>.ifc` (IFC4, STEP format) from `out/<name>.building.json`
using [web-ifc](https://github.com/ThatOpen/engine_web-ifc) 0.0.80. The writer is
`src/ifc/writer.ts`. Never write or patch IFC by hand. Change the model or the writer instead.

## Spatial structure

```
IfcProject  project.id
└─ IfcSite  site.id
   └─ IfcBuilding  building.id
      └─ IfcBuildingStorey  storey.id        (Elevation = storey.elevation)
         ├─ IfcWall … IfcSlab … IfcDoor … IfcWindow   contained in the storey
         ├─ IfcStair  stair.id               contained in the storey it climbs from
         │  └─ IfcStairFlight … IfcSlab (LANDING)      aggregated under the stair
         └─ IfcSpace  room.id                            aggregated under the storey
```

Units: millimetres for length, m² for area, m³ for volume and radians for plane angle.

## Element mapping

| Model | IFC | Geometry |
|---|---|---|
| Wall | `IfcWall` (`NOTDEFINED`) | `Axis` polyline and `Body` extruded rectangle. Local X runs along the wall and the origin is at the wall start, offset by its justification |
| Opening | `IfcOpeningElement` + `IfcRelVoidsElement` | box the size of the opening, extended 10 mm past each face of the wall so the cut is clean. A window with a `reveal` is an `IfcArbitraryClosedProfileDef` of its plan outline instead, square from one face to the middle of the wall and splayed to the other, its splayed jambs carried on 10 mm past the face |
| Door | `IfcDoor` + `IfcRelFillsElement` | 50 mm leaf in the opening; with its component's frame, three 70 mm deep `frame`-coloured pieces (jambs and head) and the leaf shrunk to fit inside them. `OperationType` is `SINGLE_SWING_LEFT` or `SINGLE_SWING_RIGHT` from `swing` |
| Doorway | `IfcOpeningElement` + `IfcRelVoidsElement` only | no `IfcDoor` or `IfcRelFillsElement`; the opening's `Tag` is the doorway id and its `Name` the doorway's name |
| Window | `IfcWindow` + `IfcRelFillsElement` | 50 mm glazing panel at the sill height; with its component's frame and glazing bars, one panel per pane and a 70 mm deep `frame`-coloured box per frame piece and bar, none overlapping (`src/geometry/window.ts`) |
| Slab | `IfcSlab` (`FLOOR`) | outline extruded up to `elevationOffset`, `thickness` deep |
| Stair | `IfcStair`, `PredefinedType` from its flights' turn | none. A container only, so its geometry is counted once, through its flights and landings, which are aggregated under it by one `IfcRelAggregates` |
| Stair flight | `IfcStairFlight` (`STRAIGHT`), aggregated under its stair | the stepped side profile with a flat tapered soffit (a hollow waist, not a solid block) extruded across the flight's `width`. Local X runs along the flight and local Y is up, so the extrusion goes across. `NumberOfRisers`, `NumberOfTreads` (risers − 1), `RiserHeight` and `TreadLength` are the derived values |
| Stair landing | `IfcSlab` (`LANDING`), aggregated under its stair | outline extruded down from the landing's derived level by its `thickness` |
| Door component | `IfcDoorType` (`DOOR`), declared in the project (`IfcRelDeclares`), linked to its doors by `IfcRelDefinesByType` | none. `Name` is the component name, `Tag` its id. `OperationType` is `NOTDEFINED`, because handing differs door by door; each `IfcDoor` keeps its own |
| Window component | `IfcWindowType` (`WINDOW`), declared and linked the same way | none |
| Room | `IfcSpace` (`INTERNAL`) | `FootPrint` 2D outline only, because rooms have no height yet. `Name` is the room id and `LongName` the room name |

- Every element's `Tag` is its model id, and its `Name` is the model `name` (falling back to the id).
- Window partitioning follows the glazing grid, on both the type and each instance: one pane is
  `SINGLE_PANEL`; two side by side or stacked are `DOUBLE_PANEL_VERTICAL` or
  `DOUBLE_PANEL_HORIZONTAL`; three side by side or stacked are `TRIPLE_PANEL_VERTICAL` or
  `TRIPLE_PANEL_HORIZONTAL`. Any other grid, such as 3 × 2, is `USERDEFINED` with
  `UserDefinedPartitioningType` `"3x2 grid"`. IFC4 has no `MULTIPLE_PANEL` value.
- Walls, slabs, doors, glazing, frames and glazing bars, stair flights and landings, and railings
  carry `IfcStyledItem` surface colours (see [Colours](#colours)). They are only so the elements can
  be told apart in any viewer; they have no building meaning.
- A stair's `PredefinedType` comes from the turning angle between its flights: one flight is
  `STRAIGHT_RUN_STAIR`, two flights at 0°, 90° or 180° are `TWO_STRAIGHT_RUN_STAIR`,
  `QUARTER_TURN_STAIR` or `HALF_TURN_STAIR`, and anything else is `NOTDEFINED`. These are the IFC4
  attribute names: IFC2x3 called the stair's `ShapeType` and a flight's `NumberOfRiser`, and IFC4
  rejects both spellings.
- Door handing follows the IFC4 convention: look at the door from the side it opens towards. If
  the hinge is on your left, it is `SINGLE_SWING_LEFT`.

## Colours

The surface colours are the `STYLES` table in `src/ifc/styles.ts`: `wall`, `slab`, `ground`, `door`,
`glazing`, `frame`, `stair` and `railing`. They are presentation only, but the viewer depends on them:

- `styleOfColour` in `viewer/style-of.ts` matches each material's colour to the nearest `STYLES`
  entry, within a distance of 0.02 in three.js's linear working space, and `patchMaterial` in
  `viewer/main.ts` repaints what it recognises. In plan style a `wall` entry gets charcoal tops, a
  `slab` or `ground` entry has its tops discarded, and a `stair` entry gets tread bands.
- So **a new entry must be well clear of every existing one**, above all `wall`, `slab` and
  `ground`. A colour too close to `wall` has its upward faces painted charcoal; too close to `slab`
  and they vanish. An element the viewer should leave alone needs a colour no entry is near.
- Nothing tests the distances yet. When adding an entry, compute it against each existing one and
  check the element in the viewer in plan style and with `?style=ifc`.
- The plan has its own colour table ([Rendering](rendering.md#colours)). The two tables are
  separate, and each has its own rule.

## GlobalIds

GlobalIds are **deterministic**:

1. Make a UUIDv5 from the project namespace `ccd47317-e750-4598-9af4-4e20a6f6deca` and a key.
2. Compress it to IFC's 22-character base-64 form.

The key is the element id for elements. Things that have no id of their own get a derived key:

| Entity | Key |
|---|---|
| opening element for `door-front` | `door-front#opening` |
| doorway opening element | the doorway id, e.g. `doorway-west` (there is no door entity) |
| voids / fills relationships | `<id>#voids`, `<id>#fills` |
| storey containment / space aggregation | `<storey>#contains`, `<storey>#spaces` |
| other aggregations, including a stair's flights and landing under their stair | `<parent>#aggregates`, e.g. `stair-main#aggregates` |
| door or window type | the component id, e.g. `door-type-internal` |
| its instances / the project's type declarations | `<component>#instances`, `<project>#types` |

As a result:

- The same model always gives a byte-identical IFC. The header timestamp is fixed at
  `1970-01-01T00:00:00` and the authorization is `'none'`.
- Moving or resizing an element keeps its GlobalId, so IFC tools see the same element, changed.
- Renaming an id produces a new GlobalId.

The implementation is in `src/ifc/guid.ts`. `tests/guid.test.ts` checks it against the RFC 4122
UUIDv5 vector and IfcOpenShell's own GUID compression.

## Verification

`build` checks every IFC it writes in two independent ways.

### 1. Geometry round-trip (web-ifc)

`src/ifc/roundtrip.ts` re-opens the IFC, meshes every element and compares the mesh volumes with
the model:

- **Wall:** length × thickness × height, minus every opening in it. This only matches if the
  openings actually cut the wall. An opening cuts width × thickness × height, plus splay ×
  thickness / 2 × height for a splayed reveal (the two triangles at its jambs, splay being
  thickness / 2 × tan(angle)). So a void that is square when the model says splayed fails here.
- **Slab:** outline area × thickness.
- **Door or window panel:** width × height × 50 mm. A doorway has no fill, so it has no panel volume; its opening still cuts the wall.

The tolerance is 0.1% relative. A mismatch is an ERROR against the element id.

### 2. IfcOpenShell validation

`validator/validate.py` is a [PEP 723](https://peps.python.org/pep-0723/) script that `uv run`
executes with pinned `ifcopenshell==0.9.0.post1`. It runs `ifcopenshell.validate` with
`express_rules=True`, which checks:

- the schema (entity and attribute types)
- inverse attributes
- IFC4's EXPRESS where-rules, for example `IfcPositiveLengthMeasure.WR1`

Each finding is printed as one JSON line. `src/ifc/validate.ts` turns these into issues:

```
ERROR   wall-south: ifc: Depth: … IfcPositiveLengthMeasure.WR1
```

The validator walks back from the offending geometry to the element that owns it, so findings
name a model id rather than an IFC `#123` line. If `uv` is missing, `build` reports an ERROR
with the hint `brew install uv`.

The bridge runs `validator/validate.py` from the project root, so `build` works from any working
directory. Exit status 1 with a summary is normal (the IFC has findings); a missing summary or any
other exit status is reported as a crash with the last lines of stderr. A stdout line that is not
JSON is reported as an ERROR quoting the line, and the `valid … N errors` count includes it rather
than printing a misleading zero.

To run the validator on its own:

```sh
uv run validator/validate.py out/example-cottage.ifc
```

## Viewing the IFC

Use `npm run view` (see [Getting started](getting-started.md#the-3d-viewer)), or open the file in
any IFC viewer, such as [Bonsai](https://bonsaibim.org/).
