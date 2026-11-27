# Development

## Commands

```sh
npm test              # vitest: units, schema, helpers, loading, rendering, GUIDs, IFC + validator, 3D vs plan
npm run test:fast     # the same without uv, Chromium or CLI subprocess tests
npm run typecheck     # tsc for src/, models/, tests/ and scripts/, then separately for src/frontend/
npm run format        # prettier --write
npm run format:check  # prettier --check (CI)
npm run view           # interactive viewer (Vite dev server)
npm run viewer:build   # production viewer bundle in dist/
npm run viewer:preview # serve the built viewer
npm run check         # model checks only, writing nothing
npm run all           # build, then render if the build succeeded
npm run watch         # rebuild a model on save, beside npm run view
npm run schema        # regenerate schema/building.schema.json from the zod schema
```

The IFC tests call the real validator, so `uv` must be installed. The first run downloads
IfcOpenShell into uv's cache. The 3D-versus-plan test runs the viewer in Chromium,
which `npm install` downloads (see [Getting started](getting-started.md#prerequisites)).

## Watching models

Run `npm run view` and `npm run watch` in two terminals. With no path the watcher rebuilds any
model or revision under `models/` whose TypeScript sources change; give paths to watch only those:

```sh
npm run watch models/elmstead
npm run watch models/examples/example-cottage/revisions/rear-extension.ts
```

Each save runs `build` for its model, with the checks, JSON, IFC, round-trip and IfcOpenShell
validation, debounced and one build at a time. It writes no plan or 3D snapshot. A model that fails
to load or check writes nothing, so the previous outputs stay; a model that fails IFC verification
leaves the files it wrote, and the watcher reports the failure and keeps running. A shared helper
folder under `revisions/` without its own `index.ts` belongs to the revisions that import it, so
saving it alone builds nothing. A path that does not resolve to a model or revision prints the usage
and exits 2. The viewer reloads the rebuilt model in place. Stop the watcher with Ctrl-C.

## Model checks

`src/backend/checks/model.ts` holds the cross-element rules that the schema cannot express. `checkModel`
runs them before `build` writes anything and before `render` writes a plan; an ERROR means no
output is written and the command exits 1. The rules are:

- component ids are unique, each `componentId` names a component of its own kind, a door's frame
  leaves room for a leaf, and a window's frame and glazing bars leave room for glass
- every id-bearing node has a model-unique id (project, site, building, storeys, walls, openings,
  slabs, rooms, stairs, stair flights, stair landings and components)
- walls have non-zero length
- openings name a wall on their storey, fit within its length and height, and do not overlap
  another opening on the same wall in both directions
- a doorway has no component or swing
- room, slab and stair landing outlines, and a room's optional dimension outline, are simple
  polygons: at least three distinct points, no repeated first or adjacent points, non-zero area
  and no self-intersection
- a stair names the next storey up, alternates flight and landing starting with a flight, runs
  somewhere on every flight, and each landing meets the flight before it and, when present, the
  flight after it within 1 mm; a stair may end with a top landing one riser below its target storey

Add new rules to the matching `check*` function, keep them pure (no writes or exits), and report
them as an `Issue` against the element id. Add a fixture test to the matching test file (see the
tests table below).

## Tests

| File                                    | Covers                                                                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/units.test.ts`                   | `mm()`, `m()`, arithmetic helpers, and the branded type (with `@ts-expect-error`)                                                                                                                                                           |
| `tests/schema.test.ts`                  | valid and invalid models, and a check that `schema/building.schema.json` is up to date                                                                                                                                                      |
| `tests/helpers.test.ts`                 | `mid`, `rectWalls`, `face`, `faceCrossing`, `centredOn`, `door`/`window` with components                                                                                                                                                    |
| `tests/polygon.test.ts`                 | `spans()`, and `polygonProblems()` for repeated points, zero area, crossings, touching and collinear overlaps                                                                                                                               |
| `tests/roundtrip.test.ts`               | the volumes the round-trip check expects for every element                                                                                                                                                                                  |
| `tests/load.test.ts`                    | loading a model file; schema errors attributed to element ids; JSON formatting                                                                                                                                                              |
| `tests/paths.test.ts`                   | a model's entry point, output name and constraints file                                                                                                                                                                                     |
| `tests/watch-targets.test.ts`           | the watcher's source-to-target mapping: model roots, revisions, constraints, single-file models and ignored paths                                                                                                                           |
| `tests/watch-queue.test.ts`             | the watcher's debounce and single-build queue: bursts, saves during a build, failed builds and stop                                                                                                                                         |
| `tests/watch-command.test.ts`           | the watcher process: an atomic save builds into a temporary output folder, SIGTERM exits 0, and an unknown path exits 2                                                                                                                     |
| `tests/render.test.ts`                  | plan determinism, SVG snapshot, wall splitting, door and window symbols, labels, PNG size, door geometry, drawing primitives and their SVG                                                                                                  |
| `tests/door.test.ts`                    | door frames; doorways: no component/swing, plan gap without leaf/swing, opening-only IFC                                                                                                                                                    |
| `tests/guid.test.ts`                    | UUIDv5 and IFC GUID compression against reference vectors; fixed GlobalIds for known ids                                                                                                                                                    |
| `tests/io.test.ts`                      | atomic writes leave the previous file and no temp file after a failure                                                                                                                                                                      |
| `tests/ifc.test.ts`                     | byte-identical IFC, GlobalId stability, door and window types, window partitioning, round-trip volumes, validator pass and fail cases                                                                                                       |
| `tests/plan-vs-3d.test.ts`              | the viewer's Top view shows the same walls, rooms and openings as the plan, for the example cottage and the two-storey fixture                                                                                                              |
| `tests/plan-vs-3d-elmstead.test.ts`     | the same for each Elmstead storey, and that the check catches a room outline run to a wall's centreline                                                                                                                                     |
| `tests/viewer-storey-selection.test.ts` | the floor picker: the status note for an unknown storey id, hidden storeys' geometry, the selector and the camera                                                                                                                           |
| `tests/viewer-storey-keys.test.ts`      | the storey keyboard shortcut: stepping through floors, the ends, the selector's focus, modifiers, single-storey models, snapshots and walk mode                                                                                             |
| `tests/viewer-presentation.test.ts`     | the railings, the stair's tread bands, the ground slab's colour, and that no uploaded texture exceeds 1024 × 1024 texels                                                                                                                    |
| `tests/window.test.ts`                  | frames and glazing bars: pane ratios, no overlaps, frame inside the window's size, fit checks, IFC volumes, plan symbol                                                                                                                     |
| `tests/checks.test.ts`                  | schema-issue attribution, component checks plus id, zero-length wall, opening host/fit/overlap and outline rules                                                                                                                            |
| `tests/cli.test.ts`                     | `build`/`check`/`all`, failure fixtures, render-before-build and missing-Chromium warnings, exit statuses, constraints; a base model draws no Diff snapshots                                                                                |
| `tests/cli-revisions.test.ts`           | building, checking and rendering revisions, their constraints, and the diff file and summary                                                                                                                                                |
| `tests/cli-diff-snapshots.test.ts`      | a revision's Diff snapshots: drawn with a warning until the base is built, in full after (the slowest CLI tests: each render writes ten 3D pictures)                                                                                        |
| `tests/viewer-diff-mode.test.ts`        | Diff mode in the viewer: the toggles, colours and outlines, the plan drawing and the changes panel                                                                                                                                          |
| `tests/viewer-diff-ghosts.test.ts`      | Diff mode's removed elements (ghosts), Transparency and hover status                                                                                                                                                                        |
| `tests/viewer-hot-reload.test.ts`       | a rebuilt IFC in place: camera, page, sidecar JSON, measurements, walk mode, pickers, Diff base and recovery                                                                                                                                |
| `tests/ci-config.test.ts`               | the CI matrix's groups, its `rest` excludes and `test:fast`'s excludes name the same heavy files                                                                                                                                            |
| `tests/validate.test.ts`                | validator bridge: non-JSON output, truncated JSON, wrong-shaped lines, summary defaults, crash status and exit 1 with findings (fake `uv`)                                                                                                  |
| `tests/viewer.test.ts`                  | layer disposal keeping shared materials, path confinement, malformed encoding and `?view=` fallback; measurement maths, snap choice and click slop; element id/name labels; plan-overlay geometry (scale, run order, depth, text placement) |
| `tests/frontend-boundaries.test.ts`     | the import boundary: shared stays browser-safe, and browser frontend code imports no Node or backend modules                                                                                                                                |
| `tests/viewer-plugin.test.ts`           | the dev and preview routes: model list, IFCs, WASM, 404s and request confinement                                                                                                                                                            |
| `tests/viewer-identify.test.ts`         | the Ids toggle, hover tooltip content, drag/view/walk/storey composition, the `?ids` lifecycle, room-id labels and the snapshot exemption in headless Chromium                                                                              |
| `tests/viewer-measure.test.ts`          | snapped picks, drag/tap handling, Clear/Escape, model changes and the snapshot exemption in headless Chromium                                                                                                                               |
| `tests/snapshot.test.ts`                | a viewer failure is an ERROR and the server closes                                                                                                                                                                                          |
| `tests/toolchain.test.ts`               | web-ifc and uv/IfcOpenShell are available                                                                                                                                                                                                   |

The three viewer files above share Chromium, the viewer's server and the pixel helpers through
`tests/support/viewer-page.ts` (call `useViewer()` at the top of the file). Their tests run one
after another on one page, so a file is the unit CI can run in parallel: keep a new viewer file
to about two minutes on CI, and split it when it grows past that.

The `plan-vs-3d` files build each model into a temporary folder, serves it with the viewer
(`ELMSTEAD_OUT_DIR`), reads the WebGL canvas back and compares it with the plan's pixels
(`tests/support/plan-vs-3d.ts`):

- Pixels are classified as wall, room fill or paper by colour. Text, lines and antialiasing are
  neither and are ignored, so the test is about geometry, not styling.
- The images are aligned by the walls' extent and compared in overlapping 500 mm tiles. A tile
  fails above 10% mismatch. A wrong door gap changes about 0.1% of the whole image, but about 17%
  of its tile.
- A failure lists the tiles in metres from the outer walls' south-west corner, so you can find the
  spot on the plan.
- Some storeys are skipped. A storey with a pitched wall is skipped because a sloped top's cut
  differs from its top view. A storey whose walls span less than 2 m in either direction, such as a
  half landing framed by a narrow extension or by one wall, is skipped because the alignment counts
  only rows and columns with a whole floor's worth of wall, and those walls don't have enough.

If you change the plan renderer on purpose, review the new SVG and update the snapshot with
`npx vitest run -u`.

### Measuring the viewer

Two scripts measure a viewer change against another checkout, for example a worktree of `main`.
They are not tests: timings and antialiasing vary too much between machines and runs to assert
on, so compare two runs on the same machine.

```sh
git worktree add --detach ../elmstead-main origin/main && ln -s "$PWD/node_modules" ../elmstead-main/
npx tsx scripts/bench-viewer.ts elmstead --root ../elmstead-main   # before
npx tsx scripts/bench-viewer.ts elmstead                           # after; --gpu for the real GPU
npx tsx scripts/compare-viewer.ts --before ../elmstead-main elmstead
```

- `bench-viewer.ts` prints JSON with the load time, the textures uploaded (count, largest and
  total), and the median and 90th-percentile frame and GPU times while the camera orbits. It
  defaults to SwiftShader, which is slow but steady between runs.
- `compare-viewer.ts` captures plan-style views from both checkouts: the top view and two
  corners, each storey alone, and close-ups of a window, a door swing and a dimension figure. It
  writes before | after | difference images, each view's mismatch ratio, and an `index.html` to
  `out/compare-src/frontend/`.

Both serve this checkout's `out/`, so build the model first.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main` (a branch with a pull
request runs once, not once for the push and once for the PR). A new push to a pull request
cancels its stale run. Three kinds of job, all started together:

- **scope**: decides whether **full** is needed. A pull request that only changes `docs/`,
  `openspec/`, `.agents/` or `*.md` skips it; pushes to `main` always run it. It needs no
  checkout, so it finishes in seconds.
- **fast**: `npm ci`, `npm run typecheck`, `npm run format:check`, a schema freshness check
  (`npm run schema && git diff --exit-code schema/`), `npm run viewer:build` and
  `npm run test:fast`. It is the quick signal; **full** does not wait for it.
- **full**: installs uv and Chromium's system libraries, then runs `npm test`, including the
  IfcOpenShell validator and the 3D-versus-plan comparison. It runs as a matrix of groups, one
  runner each, because the browser and CLI tests fight over the cores of a single runner. Each
  heavy test file is named in a group; **rest** runs every file no group names, so a new test
  file is always run. When you add a heavy file, give it a group, add it to rest's `--exclude`
  list, and add it to `test:fast`'s `--exclude` list in `package.json` too, or **fast** runs it;
  `tests/ci-config.test.ts` fails until all three agree. Keep a group to about two minutes on CI:
  a file's tests run one after another, so split a longer file (the viewer and CLI files share
  `tests/support/viewer-page.ts`, `diff-mode-page.ts` and `cli.ts` for this).

The actions are pinned by commit SHA, matching the repo's exact-version rule.

## Generated files

| File                          | Regenerate with                          | Notes                                                                                                |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `out/**`                      | `npm run build` / `npm run render`       | git-ignored; never edit                                                                              |
| `out/<name>.constraints.json` | `npm run build`                          | resolved constraints for the viewer's red labels; written only when the model has a constraints file |
| `dist/**`                     | `npm run viewer:build`                   | git-ignored; the built viewer bundle                                                                 |
| `schema/building.schema.json` | `npm run schema`                         | committed; `tests/schema.test.ts` fails if it is stale                                               |
| `validator/validate.py.lock`  | `uv lock --script validator/validate.py` | run after changing the script's dependencies                                                         |
| `tests/__snapshots__/*.svg`   | `npx vitest run -u`                      | review the diff before committing                                                                    |

## Conventions

- **TypeScript:** strict, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and
  `verbatimModuleSyntax`. ES modules, with `.js` extensions on relative imports.
- **Code style:** one-line arrow consts for small helpers, function declarations for larger bodies,
  JSDoc on exports. Prettier formats the repo; run `npm run format` before committing, and
  `npm run format:check` runs in CI.
- **Lengths:** always `Mm`. Convert to metres (`toMetres`) only for display.
- **Determinism:** no `Date.now()`, no random numbers, and no iteration over unordered sources in
  anything that ends up in `out/`.
- **Messages:** report problems as an `Issue` (`src/backend/checks/issue.ts`) against an element id.
- **Versions:** pin dependencies exactly. Check the current release before adding or upgrading a
  dependency.
- **Commits:** keep each change small and runnable. Run `npm test`, `npm run typecheck` and
  `npm run format` before committing.

## Adding a new element type

Keep the schema small. Add a type only when a real model needs it, and agree the shape first. An
existing type, a new optional field on one, or a modelling pattern (as the external and half-landing
storeys are) often does the job.

The plan SVG, the IFC and the viewer are three separate renderings of one model. A type that is
right in two and wrong in the third passes every unit test, so decide how it looks in each, and its
colours, before you write code. The [`add-support-for-new-element-types`](../.agents/skills/add-support-for-new-element-types/SKILL.md)
skill walks through that. Then work through this list in order. The railing (`src/shared/geometry/railing.ts`
and every file that mentions `railing`) is the most recent example.

**The model**

1. **Schema:** add a strict zod object with `.meta({ id })` in `src/shared/schema/schema.ts`, put it on
   the storey (or wherever it belongs), and export its inferred type. Use `Mm` for every length
   and give it an `id`.
2. **Ids:** add its collection to `STOREY_COLLECTIONS` and its kind to the `IdNode` union and
   `idNodes` in `src/shared/schema/ids.ts`. Id uniqueness, GlobalIds, constraints and the diff all find
   elements through it.
3. **JSON Schema:** run `npm run schema` and commit `schema/building.schema.json`.
4. **Revisions:** add its schema to `SCHEMAS` in `src/backend/model/revise.ts`, so a revision can add,
   replace and remove it.
5. **Diff:** add its kind to `COMPARED` in `src/shared/diff/index.ts`, and its collection to the ones
   `signature` leaves out of a storey. A kind missing here never shows up in a revision's diff.
6. **Helpers** (optional): add authoring helpers to `src/backend/model/helpers.ts`.
7. **Checks:** add model-level rules for it to `src/backend/checks/`. Constraints can point at a kind
   only if `src/backend/constraints/` looks it up; add it there only when a measurement needs it.
8. **Geometry** (when the IFC, the round-trip and the plan share it): put it in
   `src/shared/geometry/<kind>.ts`, as the railing and stair do, so the three cannot disagree.

**The IFC**

9. **Writer:** map it to an IFC4 entity in `src/backend/ifc/writer.ts`:
   - GlobalId from `ifcGuid(id)`, and `Tag` set to the id (the viewer finds elements by `Tag`)
   - spatial containment
   - geometry and a style
10. **IFC colour:** add its entry to `STYLES` in `src/shared/ifc/styles.ts`. It must be far from every
    other entry (see [IFC output](ifc.md#colours)).
11. **Round-trip:** add a volume (or other geometric) check to `src/backend/ifc/roundtrip.ts`.

**The plan**

12. **Draw it** in `src/shared/render/plan.ts` with `class` and `data-id` attributes. Say whether it
    widens the drawing's extent (`makeView`) and where it falls in the draw order.
13. **Plan colour:** add it to `C` in `src/shared/render/style.ts`. It must stay clear of wall, room and
    paper unless the element should take part in the plan-versus-3D comparison (see
    [Rendering](rendering.md#colours)).

**The viewer**

14. **Storey ownership:** add it to the owner map in `applyStoreyVisibility` in `src/frontend/scene/engine.ts`,
    so the storey picker hides it with its storey.
15. **Bounds:** add its points to `shownBox`, and its height to `setView`'s vertical extent, if
    either can reach beyond the walls, slabs and rooms.
16. **Presentation:** if it needs a recolour in plan style or a shader patch, add it to
    `patchMaterial`. The viewer recognises it by its IFC colour (`src/frontend/scene/style-of.ts`), so step 10
    decides whether this is possible.
17. **Plan-versus-3D:** the comparison either compares the element or ignores it. A plan colour
    that matches none of wall, room or paper is ignored (`isIgnoredColour` in
    `tests/support/plan-vs-3d.ts`); a storey with pitched walls or walls under 2 m across is
    skipped (`comparable` in `tests/support/plan-compare.ts`). Make that a decision, and write
    down why. ELM-11 and ELM-17 each had to extend the skip rule.

**Tests, example and docs**

18. **Tests:** cover the schema, the ids (`tests/ids.test.ts`), the revision and the diff
    (`tests/revise.test.ts`, `tests/diff.test.ts`), the checks, the writer (GlobalIds and
    validation), the round-trip, the renderer with its SVG snapshot, and the viewer's
    presentation (`tests/viewer-presentation.test.ts`). `tests/railing.test.ts` is a model for a
    geometry module's own test.
19. **Example:** use it in a model, then run the pipeline and look at the plan PNG, the 3D PNGs
    and the viewer, with the element's storey shown alone and in a Diff view of a revision that
    adds it.
20. **Docs:** update [modelling.md](modelling.md), [ifc.md](ifc.md) and [rendering.md](rendering.md).
