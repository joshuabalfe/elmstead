# elmstead docs

elmstead is a building model that is written in TypeScript, validated against a small JSON schema,
and turned into IFC4, plan drawings and 3D snapshots. It is designed to be edited by an LLM (or a
person) through code, with every output regenerated and checked on each run.

| Doc                                   | Read it when you want to…                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| [Getting started](getting-started.md) | install the toolchain, run the pipeline, open the viewer                         |
| [Architecture](architecture.md)       | understand the pipeline, the module layout and why it is shaped this way         |
| [Modelling](modelling.md)             | write or change a model in `models/` — units, coordinates, ids, helpers          |
| [IFC output](ifc.md)                  | know how elements map to IFC4, how GlobalIds are made, how the file is validated |
| [Rendering](rendering.md)             | know what the plan drawings and 3D snapshots show and how they are produced      |
| [Development](development.md)         | run tests, regenerate the JSON Schema, add a new element type                    |

## Status

| Command          | State                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| `npm run build`  | done — model → JSON → IFC, with geometry round-trip and IfcOpenShell validation    |
| `npm run render` | done — per-storey plan SVG/PNG, plus 3D PNGs from the IFC                          |
| `npm run view`   | done — local ThatOpen viewer in the browser                                        |
| `npm run check`  | done — model-level rules (ids, opening fit, outlines, components), writing nothing |
| `npm run all`    | done — build, then render if the build succeeded                                   |
