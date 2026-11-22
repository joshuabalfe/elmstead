# Tasks

## 1. Storey visibility

- [ ] 1.1 Parse `?storeys=` as a comma-separated list of storey ids; with an id that names no storey, show every storey and put the unknown id in the status line; verify a browser test covers one-of-two, unknown and omitted
- [ ] 1.2 Map each storey to its fragment local ids by walking `getSpatialStructure()` through containment *and* aggregation, so a hidden storey takes its stairs with it; hide the rest with `setVisible`; verify a hidden storey leaves nothing drawn, including its room labels, dimensions and wall-top planes
- [ ] 1.3 Verify switching the parameter reloads or re-shows correctly alongside a model change and a walk-mode entry, and that snapshots ignore the parameter as they ignore walk mode

## 2. Plan style as a single-storey mode

- [ ] 2.1 With exactly one storey shown, draw that storey's fills at its elevation, its charcoal wall tops and its plan linework, and keep ELM-4's straight-down slab-top discard; verify the top view of an upper storey shows its own fills
- [ ] 2.2 With more than one storey shown, render the IFC colours with no fills and no discard, keeping the white background, no grid and the annotations; verify a corner view and the top view both occlude correctly on the two-storey model
- [ ] 2.3 Honour `?style=ifc` always and `?style=plan` only with one storey shown; verify the fallback is documented in the status line or help text

## 3. Walk mode on the shown storeys

- [ ] 3.1 Take the entry pose from the lowest shown storey's elevation and the shown geometry's footprint centre; verify entering walk mode with the ground storey hidden stands on the first floor

## 4. Plan-versus-3D per storey

- [ ] 4.1 Compare every storey's plan with the top view of that storey alone, on the cottage, Elmstead and ELM-4's two-storey model; verify both storeys of the two-storey model pass with their different layouts
- [ ] 4.2 Keep the existing centreline regression case working against the storey it belongs to

## 5. Docs and verification

- [ ] 5.1 Document `?storeys=`, the single-storey plan mode and the occlusive multi-storey render in `docs/rendering.md`, including that `?style=plan` falls back to the IFC colours with several storeys shown
- [ ] 5.2 Run `npm test`, `npm run typecheck` and `npx openspec validate --all`; verify all pass
- [ ] 5.3 Eye-check in the browser: the whole two-storey model from a corner and from above with the slab solid; each storey alone as its plan; orbit out of a single-storey top view and back

## Workflow follow-up

- Archive the change after implementation and the project's review requirements are satisfied.
- Verify the archived result.
- The checkbox UI, and making the occlusive render the named default in the help text, are the next
  change on this primitive; a roof waits for the model to grow one.
