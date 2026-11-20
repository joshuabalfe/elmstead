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
  - The loader keeps IFC coordinates as they are (`COORDINATE_TO_ORIGIN: false`), so anything
    drawn from the model lines up with the IFC.
  - With `?snapshot=1` in the URL it hides the toolbar and sets `window.__elmsteadReady` once the
    frame is drawn, which is what the snapshot driver waits for.
- Room labels: `main.ts` also reads `out/<name>.building.json` and draws each storey's room
  labels at its ceiling, 10 mm above the top of its tallest wall (the schema has no ceiling
  height). Being above the walls, they read from every camera.
  - Dimension lines lie flat, as if drawn on a glass ceiling: the plan's own room and overall
    dimensions (`renderPlanAnnotations(storey, { names: false })` in `src/render/plan.ts`) drawn
    to a texture at 2.5 mm per pixel.
  - Room names and areas are billboards (sprites) that turn to face the camera, at the room's
    centroid and the plan's text size (`roomTags` and `ROOM_LABEL` in `src/render/style.ts`).
    They are drawn over the model so the wall tops don't cut them.
  - All of it has a white halo so it reads over the model.
  - A compass in the bottom-right corner points to true north (`site.northAngle`) as it appears on
    screen. It projects a north-pointing line on the ground, so it is right in perspective views
    too, and it turns as the camera moves.
  - They come from the model JSON, not the IFC, because the IFC has no room dimensions.
  - The **Labels** button toggles them. `?labels=0` or `?labels=1` in the URL sets them.
  - They are on by default, but off in snapshots (`?snapshot=1`), so the 3D PNGs show only the IFC.
- Plan colouring, the same in every view (`applyStyle` in `main.ts`):
  - Floors are the plan's own room fills (`renderRoomFills` in `src/render/plan.ts`), cream rooms
    on white, drawn first and without depth so the model always covers them. The slab's top face
    is not drawn; its edges still show. (A wall's underside lies exactly on the slab's top face,
    and on real GPUs the two fight for depth.) Only the lowest storey's floor, for now.
  - Walls keep their IFC colour and lighting, except faces that look upwards (wall tops, window
    sills), which are the plan's charcoal, unlit. A small shader patch picks those out by their
    world-space normal, so the material itself is unchanged.
  - The plan's walls, doors and windows (`renderWallTops`: wall pieces, door gaps, leaves and
    swings, window symbols, dashed uncut openings) lie 5 mm above the wall tops, so looking down
    shows what is in the walls below, as the plan does. From above, the Top view reads like the
    plan without cutting the model.
  - White background, no grid.
- Snapshots (`?snapshot=1`) show the IFC's own colours, so the 3D PNGs still check what other
  viewers will show. `?style=ifc` or `?style=plan` in the URL forces a style.
- `npm run view` runs the same app for interactive use. It reloads the page whenever an IFC in
  `out/` changes.
