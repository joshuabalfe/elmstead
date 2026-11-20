# Getting started

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node.js ≥ 22 | runs the TypeScript pipeline (via `tsx`) | your usual Node install |
| [uv](https://docs.astral.sh/uv/) | runs the Python IFC validator in an isolated, locked environment | `brew install uv` |
| Chromium for Playwright | headless 3D snapshots (optional) | `npx playwright install chromium` |

You don't need to install Python packages yourself. `validator/validate.py` declares its
dependencies inline (PEP 723), and `uv run` installs them from `validator/validate.py.lock` the
first time it runs.

```sh
npm install
```

## Running the pipeline

Every command takes the path to a model: a single file, or a folder for a multi-file model:

```sh
npm run build  models/example-cottage.ts    # model → JSON → IFC, then validate the IFC
npm run render models/example-cottage.ts    # plan SVG/PNG per storey, then 3D PNGs from the IFC
npm run build  models/elmstead              # same as models/elmstead/index.ts
```

`render` uses the IFC from the last `build` for its 3D snapshots, so run `build` first.

Flags:

| Flag | Command | Effect |
|---|---|---|
| `--ids` | `render` | label every element with its id on the plan (useful when editing) |
| `--no-3d` | `render` | skip the headless-browser 3D snapshots |

A command exits non-zero if any ERROR was reported.

### Output

Everything is written to `out/`, which is git-ignored. Never edit it by hand; it is regenerated on
every run.

| File | From |
|---|---|
| `out/<name>.building.json` | `build`: the validated model, deterministic formatting |
| `out/<name>.ifc` | `build`: IFC4, written from the JSON |
| `out/<name>.<storey-id>.plan.svg` / `.png` | `render`: one plan per storey |
| `out/<name>.3d-{sw,se,ne,nw,top}.png` | `render`: 3D snapshots of the IFC |

`<name>` is the model's file name, e.g. `example-cottage`, or its folder name for a multi-file
model, e.g. `elmstead`.

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
http://localhost:5173) that loads the IFC files in `out/`. It has a model picker and SW/SE/NE/NW/Top
camera buttons. It shows the plan's room labels and dimensions at ceiling height and a compass pointing to
true north; the **Labels** button hides them. Every view uses the plan's colours (room fills for
floors, charcoal wall tops), and the **Top** view is also cut at 1.2 m like the plan. When an IFC in `out/` changes it reloads itself, so leave it open while you
edit and re-run `build`.

Everything is served locally, so the viewer works offline. Stop it with Ctrl-C.

Any other IFC viewer can open `out/<name>.ifc` too, for example [Bonsai](https://bonsaibim.org/)
(Blender).
