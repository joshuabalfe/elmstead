# Rendering

`npm run render <model>` produces two kinds of image:

| Output | Drawn from | Code |
|---|---|---|
| `out/<name>.<storey>.plan.svg` / `.png` | the model (JSON) | `src/render/plan.ts`, `png.ts` |
| `out/<name>.3d-{sw,se,ne,nw,top}.png` | the IFC file | `src/render/snapshot3d.ts`, `viewer/` |

Look at the PNGs after every change. They are the quickest way to catch something the checks
don't, such as a door swinging the wrong way.

## Plans

One SVG per storey, at 1 px = 10 mm in the SVG and rasterised at 2× to PNG. The plan is drawn in
this order:

1. slab outline, dashed
2. room fills
3. walls at their true thickness, split around the openings
4. door leaves with swing arcs, and window symbols (frame and two glazing lines)
5. room labels (name and area in m²) and room dimensions: the longest clear wall-to-wall span
   east–west and north–south, in mm, drawn as dimension lines inside the room and kept clear of
   the label where the room is wide enough
6. element ids in red, only with `--ids`
7. overall dimensions
8. title, north arrow and a 5 m scale bar

Every element is an SVG group with `class` (`wall`, `door`, `window`, `room`, `room-dimensions`, `slab`) and
`data-id` set to its model id, so the SVG can be inspected or queried.

Drawing style is all in one place: `src/render/style.ts` holds the scale, colours, font and
margins.

### Determinism

- Numbers are written with one decimal place.
- Fonts are the bundled DejaVu TTFs (`dejavu-fonts-ttf`), and resvg is told not to load system
  fonts.

So the PNG is identical on every machine. `tests/render.test.ts` snapshot-tests the cottage's
SVG in `tests/__snapshots__/`.

## 3D snapshots

`render` starts the viewer (below) on a free port, opens it in headless Chromium through
Playwright, and saves a 1200 × 900 PNG for each of five cameras:

- `sw`, `se`, `ne`, `nw`: perspective views from each corner, looking down
- `top`: an orthographic plan view

The snapshots show the IFC file, not the model, so they confirm what other IFC viewers will show:
openings cut, doors and glazing in place, colours applied.

- If there is no IFC yet, `render` warns and skips the snapshots. Run `build` first.
- If Chromium isn't installed, `render` warns with the fix (`npx playwright install chromium`)
  and still draws the plans.
- Pass `--no-3d` to skip the snapshots. They add about 5 seconds.

## The viewer

`viewer/` is a small Vite app built on
[@thatopen/components](https://github.com/ThatOpen/engine_components) and three.js.

- `vite.config.ts` serves `/models.json` (the IFCs in `out/`), `/out/*` and the web-ifc WASM
  from `node_modules`, so nothing comes from a CDN.
- `main.ts` loads the IFC through ThatOpen's IFC loader and sets up the camera views.
  - In the scene Y is up and plan north is −Z.
  - With `?snapshot=1` in the URL it hides the toolbar and sets `window.__elmsteadReady` once the
    frame is drawn, which is what the snapshot driver waits for.
- `npm run view` runs the same app for interactive use. It reloads the page whenever an IFC in
  `out/` changes.
