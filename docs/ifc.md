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
         └─ IfcSpace  room.id                            aggregated under the storey
```

Units: millimetres for length, m² for area, m³ for volume and radians for plane angle.

## Element mapping

| Model | IFC | Geometry |
|---|---|---|
| Wall | `IfcWall` (`NOTDEFINED`) | `Axis` polyline and `Body` extruded rectangle. Local X runs along the wall and the origin is at the wall start, offset by its justification |
| Opening | `IfcOpeningElement` + `IfcRelVoidsElement` | box the size of the opening, extended 10 mm past each face of the wall so the cut is clean |
| Door | `IfcDoor` + `IfcRelFillsElement` | 50 mm panel in the opening; `OperationType` is `SINGLE_SWING_LEFT` or `SINGLE_SWING_RIGHT` from `swing` |
| Window | `IfcWindow` + `IfcRelFillsElement` | 50 mm glazing panel at the sill height |
| Slab | `IfcSlab` (`FLOOR`) | outline extruded up to `elevationOffset`, `thickness` deep |
| Door component | `IfcDoorType` (`DOOR`), declared in the project (`IfcRelDeclares`), linked to its doors by `IfcRelDefinesByType` | none. `Name` is the component name, `Tag` its id. `OperationType` is `NOTDEFINED`, because handing differs door by door; each `IfcDoor` keeps its own |
| Window component | `IfcWindowType` (`WINDOW`, `SINGLE_PANEL`), declared and linked the same way | none |
| Room | `IfcSpace` (`INTERNAL`) | `FootPrint` 2D outline only, because rooms have no height yet. `Name` is the room id and `LongName` the room name |

- Every element's `Tag` is its model id, and its `Name` is the model `name` (falling back to the id).
- Walls, slabs, doors and glazing carry `IfcStyledItem` surface colours. These are only so they
  can be told apart in any viewer; they have no building meaning.
- Door handing follows the IFC4 convention: look at the door from the side it opens towards. If
  the hinge is on your left, it is `SINGLE_SWING_LEFT`.

## GlobalIds

GlobalIds are **deterministic**:

1. Make a UUIDv5 from the project namespace `ccd47317-e750-4598-9af4-4e20a6f6deca` and a key.
2. Compress it to IFC's 22-character base-64 form.

The key is the element id for elements. Things that have no id of their own get a derived key:

| Entity | Key |
|---|---|
| opening element for `door-front` | `door-front#opening` |
| voids / fills relationships | `<id>#voids`, `<id>#fills` |
| storey containment / space aggregation | `<storey>#contains`, `<storey>#spaces` |
| other aggregations | `<parent>#aggregates` |
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
  openings actually cut the wall.
- **Slab:** outline area × thickness.
- **Door or window panel:** width × height × 50 mm.

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

To run the validator on its own:

```sh
uv run validator/validate.py out/example-cottage.ifc
```

## Viewing the IFC

Use `npm run view` (see [Getting started](getting-started.md#the-3d-viewer)), or open the file in
any IFC viewer, such as [Bonsai](https://bonsaibim.org/).
