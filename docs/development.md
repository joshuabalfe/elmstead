# Development

## Commands

```sh
npm test            # vitest: units, schema, helpers, loading, rendering, GUIDs, IFC + validator, 3D vs plan
npm run typecheck   # tsc for src/models/tests/scripts, and separately for viewer/
npm run schema      # regenerate schema/building.schema.json from the zod schema
```

The IFC tests call the real validator, so `uv` must be installed. The first run downloads
IfcOpenShell into uv's cache. The 3D-versus-plan test runs the viewer in Chromium,
which `npm install` downloads (see [Getting started](getting-started.md#prerequisites)).

## Model checks

`src/checks/model.ts` holds the cross-element rules that the schema cannot express. `checkModel`
runs them before `build` writes anything and before `render` writes a plan; an ERROR means no
output is written and the command exits 1. The rules are:

- component ids are unique, each `componentId` names a component of its own kind, and a window's
  frame and glazing bars leave room for glass
- every id-bearing node has a model-unique id (project, site, building, storeys, walls, openings,
  slabs, rooms and components)
- walls have non-zero length
- openings name a wall on their storey, fit within its length and height, and do not overlap
  another opening on the same wall in both directions
- room and slab outlines are simple polygons: at least three distinct points, no repeated first
  or adjacent points, non-zero area and no self-intersection

Add new rules to the matching `check*` function, keep them pure (no writes or exits), and report
them as an `Issue` against the element id. Add a fixture test to `tests/checks.test.ts`.

## Tests

| File | Covers |
|---|---|
| `tests/units.test.ts` | `mm()`, `m()`, arithmetic helpers, and the branded type (with `@ts-expect-error`) |
| `tests/schema.test.ts` | valid and invalid models, and a check that `schema/building.schema.json` is up to date |
| `tests/helpers.test.ts` | `rectWalls`, `face`, `faceCrossing`, `centredOn`, `door`/`window` with components |
| `tests/polygon.test.ts` | `spans()`, where a horizontal or vertical line crosses an outline |
| `tests/load.test.ts` | loading a model file; schema errors attributed to element ids; JSON formatting |
| `tests/render.test.ts` | plan determinism, SVG snapshot, wall splitting, door and window symbols, labels, PNG size, door geometry |
| `tests/guid.test.ts` | UUIDv5 and IFC GUID compression against reference vectors; fixed GlobalIds for known ids |
| `tests/ifc.test.ts` | byte-identical IFC, GlobalId stability, door and window types, round-trip volumes, validator pass and fail cases |
| `tests/plan-vs-3d.test.ts` | the viewer's Top view shows the same walls, rooms and openings as the plan, for each model; and that the check catches a room outline run to a wall's centreline |
| `tests/window.test.ts` | frames and glazing bars: pane ratios, no overlaps, frame inside the window's size, fit checks, IFC volumes, plan symbol |
| `tests/checks.test.ts` | component checks: unknown or wrong-kind `componentId`, duplicate component ids |
| `tests/toolchain.test.ts` | web-ifc and uv/IfcOpenShell are available |

`tests/plan-vs-3d.test.ts` builds each model into a temporary folder, serves it with the viewer
(`ELMSTEAD_OUT_DIR`), reads the WebGL canvas back and compares it with the plan's pixels
(`tests/support/plan-vs-3d.ts`):

- Pixels are classified as wall, room fill or paper by colour. Text, lines and antialiasing are
  neither and are ignored, so the test is about geometry, not styling.
- The images are aligned by the walls' extent and compared in overlapping 500 mm tiles. A tile
  fails above 10% mismatch. A wrong door gap changes about 0.1% of the whole image, but about 17%
  of its tile.
- A failure lists the tiles in metres from the outer walls' south-west corner, so you can find the
  spot on the plan.

If you change the plan renderer on purpose, review the new SVG and update the snapshot with
`npx vitest run -u`.

## Generated files

| File | Regenerate with | Notes |
|---|---|---|
| `out/**` | `npm run build` / `npm run render` | git-ignored; never edit |
| `schema/building.schema.json` | `npm run schema` | committed; `tests/schema.test.ts` fails if it is stale |
| `validator/validate.py.lock` | `uv lock --script validator/validate.py` | run after changing the script's dependencies |
| `tests/__snapshots__/*.svg` | `npx vitest run -u` | review the diff before committing |

## Conventions

- **TypeScript:** strict, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and
  `verbatimModuleSyntax`. ES modules, with `.js` extensions on relative imports.
- **Lengths:** always `Mm`. Convert to metres (`toMetres`) only for display.
- **Determinism:** no `Date.now()`, no random numbers, and no iteration over unordered sources in
  anything that ends up in `out/`.
- **Messages:** report problems as an `Issue` (`src/checks/issue.ts`) against an element id.
- **Versions:** pin dependencies exactly. Check the current release before adding or upgrading a
  dependency.
- **Commits:** keep each change small and runnable. Run `npm test` and `npm run typecheck` before
  committing.

## Adding a new element type

Keep the schema small. Add a type only when a real model needs it, and agree the shape first.
Then work through this list:

1. **Schema:** add a strict zod object with `.meta({ id })` in `src/schema/schema.ts`, put it on
   the storey (or wherever it belongs), and export its inferred type. Use `Mm` for every length
   and give it an `id`.
2. **JSON Schema:** run `npm run schema` and commit `schema/building.schema.json`.
3. **Helpers** (optional): add authoring helpers to `src/model/helpers.ts`.
4. **IFC:** map it to an IFC4 entity in `src/ifc/writer.ts`:
   - GlobalId from `ifcGuid(id)`, and `Tag` set to the id
   - spatial containment
   - geometry and a style
5. **Round-trip:** add a volume (or other geometric) check to `src/ifc/roundtrip.ts`.
6. **Plan:** draw it in `src/render/plan.ts` with `class` and `data-id` attributes.
7. **Checks:** add model-level rules for it to `src/checks/`.
8. **Tests:** cover the schema, the writer (GlobalIds and validation) and the renderer, and
   update the SVG snapshot.
9. **Example:** use it in a model, then run the pipeline and look at the PNGs.
10. **Docs:** update [modelling.md](modelling.md) and [ifc.md](ifc.md).
