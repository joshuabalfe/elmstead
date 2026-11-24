# Getting started

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node.js ≥ 22 | runs the TypeScript pipeline (via `tsx`) | your usual Node install |
| [uv](https://docs.astral.sh/uv/) | runs the Python IFC validator in an isolated, locked environment | `brew install uv` |
You don't need to install Chromium yourself either. It is a dev dependency
(`@playwright/browser-chromium`, pinned to the same version as `playwright`), and `npm install`
downloads the matching build into Playwright's cache (about 150 MB, once). The 3D snapshots and
the 3D-versus-plan test run in it. If your npm skips install scripts (`ignore-scripts`), run
`npm rebuild @playwright/browser-chromium`.

You don't need to install Python packages yourself. `validator/validate.py` declares its
dependencies inline (PEP 723), and `uv run` installs them from `validator/validate.py.lock` the
first time it runs.

```sh
npm install
```

## Running the pipeline

Every command takes the path to a model: a single file, or a folder for a multi-file model:

```sh
npm run build  models/example-cottage       # model → JSON → IFC, then validate the IFC
npm run check  models/example-cottage       # run the model checks only; writes nothing
npm run render models/example-cottage       # plan SVG/PNG per storey, then 3D PNGs from the IFC
npm run all    models/example-cottage       # build, then render if the build succeeded
npm run build  models/elmstead              # same as models/elmstead/index.ts
```

`build` and `render` run the model checks first and write nothing if any ERROR is reported.
`render` uses the IFC from the last `build` for its 3D snapshots, so run `build` first.

Flags:

| Flag | Command | Effect |
|---|---|---|
| `--ids` | `render`, `all` | label every element with its id on the plan (useful when editing) |
| `--no-3d` | `render`, `all` | skip the headless-browser 3D snapshots |

A command exits non-zero if any ERROR was reported.

### Output

Everything is written to `out/`, which is git-ignored. Never edit it by hand; it is regenerated on
every run. Set `ELMSTEAD_OUT_DIR` to write somewhere else; the commands still find the project's
model files, validator and viewer when run from any directory.

| File | From |
|---|---|
| `out/<name>.building.json` | `build`: the validated model, deterministic formatting |
| `out/<name>.ifc` | `build`: IFC4, written from the JSON |
| `out/<name>.<storey-id>.plan.svg` / `.png` | `render`: one plan per storey |
| `out/<name>.3d-{sw,se,ne,nw,top}.png` | `render`: 3D snapshots of the IFC |

`<name>` is the model's file name, or its folder name for a multi-file model, e.g.
`example-cottage` or `elmstead`.

### Reading the output

The CLI prints one line per step and one line per problem:

```
json    out/example-cottage.building.json
ifc     out/example-cottage.ifc
geom    out/example-cottage.ifc: every element meshes in web-ifc; opening cuts verified by volume
valid   out/example-cottage.ifc: 0 errors, 0 warnings (ifcopenshell.validate)
```

Problems look like `LEVEL   element-id: message`, for example:

```
ERROR   wall-hall-west: schema: storeys.0.walls.4.thickness: Too small: expected number to be >0
```

The id is always one of the model's own element ids, including for IFC validation findings, so
you can go straight to the line in `models/` that needs changing.

## The 3D viewer

```sh
npm run view
```

This opens a local [ThatOpen](https://github.com/ThatOpen) viewer (Vite dev server, normally
http://localhost:5173) that loads the IFC files in `out/`. It has a model picker and
SW/SE/NE/NW/Top camera buttons, and opens in the Top view. It shows the plan's room labels and
dimensions at ceiling height, the model's measured constraints as red labels and dotted spans, and
a compass pointing to true north. The **Labels** button hides the room text, and the
**Constraints** button shows or hides the red constraints, which start hidden. The **Ids**
button, or `?ids=1`, shows the model id of the element under the cursor (and its name, when it
has one) in a tooltip beside it — the id to name when asking for an edit, such as
`wall-hall-living`. Room labels carry the room id under the name and area, since rooms have no
solid geometry to hover. Hover identification is off while walking and in snapshots. The **Measure**
button, or `?measure=1`, starts a click-to-measure tool: click or tap two points on the model,
snapping to corners and edges. The second point is projected onto the nearest axis through the
first, so measurements run along X, Y or Z rather than diagonally. Each pair adds a numbered
measurement showing the straight-line, horizontal and vertical distances in millimetres.
Measurements stay in the viewer only; **Clear** removes them. Every view uses the plan's colours
(room fills for floors, charcoal wall tops), with door gaps and window symbols on the wall tops and
door swings on the floor, so the **Top** view reads like the plan. When an IFC in `out/` changes it
reloads itself, so leave it open while you edit and re-run `build`.

Everything is served locally, so the viewer works offline. Stop it with Ctrl-C.

Any other IFC viewer can open `out/<name>.ifc` too, for example [Bonsai](https://bonsaibim.org/)
(Blender).
