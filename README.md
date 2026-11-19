# elmstead

An LLM-editable building model: TypeScript in `models/` → validated JSON → IFC4, plan drawings and
3D snapshots.

```sh
npm install
npm run build  models/example-cottage.ts
npm run render models/example-cottage.ts
npm run view
```

See [docs/](docs/README.md) for setup, architecture, modelling conventions, IFC output,
rendering and development.
