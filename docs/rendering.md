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

1. slab fill, cream with a dashed outline
2. room fills (the same cream, on top of the slab)
3. walls at their true thickness, split around the openings. Beside a window with a splayed
   reveal the wall ends square from one face to the middle, then at the reveal's angle to the
   splayed face (`src/geometry/opening.ts`)
4. door leaves with swing arcs (inset by the door's frame), and window symbols (outline, two
   glazing lines, and a small block for each frame piece or glazing bar the cut passes through:
   jambs and vertical bars). A splayed window's outline, and the dashed outline of one the cut
   misses, follow its reveal. A doorway has no leaf or swing: its wall pieces leave the opening.
5. stairs, drawn in full rather than cut: each flight's footprint, a tread line per tread and a
   walking-direction arrow, and each landing's outline. The cut height only decides which openings
   are cut, so a half landing above it is drawn like any other geometry
6. room labels (name and area in m²) and room dimensions: the longest clear wall-to-wall span
   east–west and north–south of the room's `dimensionOutline` when it has one (otherwise its
   `outline`), in mm, drawn as dimension lines inside the room and kept clear of the label where
   the room is wide enough
7. element ids in red, only with `--ids`
8. overall dimensions
9. title, north arrow and a 5 m scale bar

Every element is an SVG group with `class` (`wall`, `door`, `window`, `room`, `room-dimensions`,
`slab`, `stair`, `stair-flight`, `stair-landing`) and `data-id` set to its model id, so the SVG can
be inspected or queried. A stair's flights and landings are groups nested inside the stair's.

Stairs are drawn by `renderPlan` alone. `renderFloor`, `renderWallTops` and `renderPlanAnnotations`,
which the viewer composites into its plan-style overlay, do not draw them. For readability the viewer
recolours the stair solids in every viewer mode including snapshots — cream / darker-cream tread
bands and an edge outline. The base IFC stair colour stays classifier-safe; the recolour is
presentation only. Stair colours stay clear of the wall, room and paper colours the plan-versus-3D
comparison classifies (`src/render/style.ts`).

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
- Chromium comes with `npm install` (`@playwright/browser-chromium`). If it is missing anyway (install
  scripts skipped), `render` warns with the fix (`npm rebuild @playwright/browser-chromium`) and
  still draws the plans. Any other viewer failure is an ERROR and exits 1.
- The viewer server and browser close on every success and failure path, and screenshots are
  written atomically alongside the other outputs.
- Pass `--no-3d` to skip the snapshots. They add about 5 seconds.

## The viewer

`viewer/` is a small Vite app built on
[@thatopen/components](https://github.com/ThatOpen/engine_components) and three.js.

- `vite.config.ts` serves `/models.json` (the IFCs in `out/`), `/out/*` and the web-ifc WASM
  from `node_modules`, so nothing comes from a CDN. `ELMSTEAD_OUT_DIR` serves another folder in
  place of `out/` (the tests use it). Requests are confined to those directories; traversal,
  sibling-directory prefixes and malformed percent-encoding return 404. It reloads on `change`
  and `add`, so an atomic IFC rename is noticed too.
- `main.ts` loads the IFC through ThatOpen's IFC loader and sets up the camera views.
  - In the scene Y is up and plan north is −Z.
  - The **SW**, **SE**, **NE** and **NW** buttons show true isometric views: an orthographic camera
    from that corner, 45° round and 35.26° above the ground, so parallel edges stay parallel and
    the building reads like a video-game diorama. The Top view is orthographic straight down.
    Snapshots keep the perspective corner cameras (see [3D snapshots](#3d-snapshots)).
  - The loader keeps IFC coordinates as they are (`COORDINATE_TO_ORIGIN: false`), so anything
    drawn from the model lines up with the IFC.
  - Every model is drawn as full geometry (`setLodMode(LodMode.ALL_VISIBLE)`). By default
    Fragments draws items it judges small on screen as lines, and thin parts such as glazing bars
    and window frames qualify even close up.
  - `?view=` accepts only `sw`, `se`, `ne`, `nw` and `top`; any other value falls back to `top`.
    The model picker is built with `textContent`, so a file name containing markup is shown
    literally.
  - `?camera=px,py,pz,tx,ty,tz` places a perspective camera at p looking at t, in the scene's
    metres (Y up, IFC +Y along −Z), for close-ups such as one window.
  - With `?snapshot=1` in the URL it hides the toolbar and sets `window.__elmsteadReady` once the
    frame is drawn, which is what the snapshot driver waits for.
- Hover identification: the **Ids** button or `?ids=1` (off by default, ignored in snapshots)
  shows a tooltip beside the cursor with the model id and name of the element under it.
  `viewer/identify.ts` maps each fragments item's `Tag`/`Name`/`LongName` to that label — the
  same ids the model code and checks use — and `main.ts` raycasts on pointermove, one pick in
  flight. It is passive: clicks still measure and drags still navigate. The tooltip hides while
  dragging, while the camera moves and throughout walk mode, and follows the storey selector,
  since the raycast skips hidden items.
- Room labels: `main.ts` also reads `out/<name>.building.json` and draws each storey's room
  labels at its ceiling, 10 mm above the top of its tallest wall (the schema has no ceiling
  height). Being above the walls, they read from every camera that can see that storey.
  - The plan's own room and overall dimension lines (`renderPlanAnnotations` in
    `src/render/plan.ts`) are drawn to one texture at 2.5 mm per pixel, as if on a glass ceiling.
    Lying flat is what lets a storey above occlude them; camera-facing billboards painted through
    floors.
  - Room names, areas and ids sit on small flat planes at the same ceiling, one per room, and each
    yaws about its room's centre to follow the camera (`updateLabelOrientation` in
    `viewer/main.ts`), so the text reads left-to-right across the screen from any view while
    still lying flat enough to be occluded by an upper floor. The id line makes rooms
    referenceable even though their 2D outlines carry no pickable geometry.
  - All of it has a white halo so it reads over the model.
  - A compass in the bottom-right corner points to true north (`site.northAngle`) as it appears on
    screen. It projects a north-pointing line on the ground, so it is right in perspective views
    too, and it turns as the camera moves.
  - They come from the model JSON, not the IFC, because the IFC has no room dimensions.
  - The **Labels** button toggles them. `?labels=0` or `?labels=1` in the URL sets them.
  - They are on by default, but off in snapshots (`?snapshot=1`), so the 3D PNGs show only the IFC.
- Constraint labels: when `build` has written `out/<name>.constraints.json`, each measured
  constraint is a red billboard at the midpoint of the span its measurement covers on its storey,
  reading `<id> <distance>` in millimetres, with a thick red dotted line along that span. They
  start hidden; the **Constraints** button or `?constraints=1` turns them on, independently of the
  room labels, and snapshots leave them off. They sit at their storey's ceiling and are occluded
  like everything else there: a storey above hides them, and hiding their storey hides them.
- Measurement tool: the **Measure** button or `?measure=1` starts it. A click or tap picks the
  nearest corner or edge within snapping range, otherwise the exact point on the face; a second
  pick is projected onto the nearest axis through the first and adds a numbered measurement, so
  measurements are axis-aligned rather than diagonal. Each one is a teal line, endpoint markers and
  a camera-facing label with the straight-line, horizontal and vertical distances, plus a row in
  the bottom-left measurement list. The line, markers and label draw above the model and the other
  overlays, so a wall, floor or storey above never hides a measurement.
  - Measurements are viewer-only: they are cleared on a model change or when walk mode starts,
    survive camera and view changes, and are ignored in snapshots. Escape cancels a pending point;
    **Clear** removes all measurements.
  - The measure layer is independent of **Labels** and **Constraints**; completed measurements
    stay visible when measure mode is off.
- Plan colouring, the same in every view (`applyStyle` in `main.ts`):
  - Floors are the plan's own floor fills and door swings (`renderFloor` in `src/render/plan.ts`),
    cream slab and room fills on white, one plane per shown storey at that storey's level. The slab
    fill covers floor outside the room outlines too, such as bay windows and alcoves. Each plane
    writes depth, so the topmost shown floor hides the storeys below it: from above you see the top
    floor's rooms, not the grey slab and not the floor beneath. In plan style a slab's top is not drawn; its
    underside is the ceiling below, and its exposed edges show the floor structure's thickness. The
    lower storey's walls stop at the slab's underside, so the slab sits on them and its 200 mm edge
    is the structure band between storeys; in `?style=ifc` the slab renders whole.
  - Walls keep their IFC colour and lighting, except faces that look upwards (wall tops, window
    sills), which are the plan's charcoal, unlit. A small shader patch picks those out by their
    world-space normal, so the material itself is unchanged.
  - The plan's walls, door gaps and windows (`renderWallTops`: wall pieces, door gaps in white,
    window symbols, dashed uncut openings) lie 5 mm above the wall tops, so looking down
    shows what is in the walls below, as the plan does. From above, the Top view reads like the
    plan without cutting the model.
  - White background, no grid.
- The **Up to:** selector lists the model's storeys lowest first; choosing one shows that storey and
  every storey below it, hiding those above, and the topmost choice shows everything. A choice
  updates the loaded model in place without moving the camera, so floors compare from one viewpoint;
  the compass follows the shown footprint, and the view buttons re-frame on request. The choice is
  written to `?storeys=` so the URL shares it. A `?storeys=` set that is not one floor's prefix
  shows a disabled **Custom** value until a floor is chosen. The selector is hidden for a
  single-storey model.
- `?storeys=a,b` shows only those storeys: everything the IFC contains or aggregates in the others is
  hidden, with their labels and floor planes. An id that names no storey is noted in the status line
  and ignored; omitting the parameter shows every storey. With one storey shown, the Top view is
  that storey's plan view, whichever storey it is.
- Navigation (`setNavigationInput` in `main.ts`), map-style in every view:
  - Left drag or one finger pans.
  - The wheel or a pinch zooms. A pinch tracks the fingers: spreading them 4× zooms about 4×. In
    the orthographic views it is a true zoom, since moving an orthographic camera closer changes
    nothing on screen.
  - The middle or right button, or three fingers, orbits.
  - Drags follow the pointer without easing, so a fast pinch is not lost to the camera's lag.
- The That Open Company logo overlay is hidden (`showLogo = false`).
- Walk mode: the **Walk** button, or `?walk=1`, enters a first-person walkthrough.
  - The camera starts at the footprint centre of the shown storeys on the lowest shown storey, at a
    fixed 1.6 m eye height, facing plan north. With no building JSON it starts 1.6 m above the IFC's
    lowest point.
  - The mouse looks around through pointer lock; W/A/S/D and the arrow keys move at 3 m/s
    relative to the heading you face. `?walk=1` shows a click-to-look prompt — browsers only
    grant pointer lock after a user gesture — and the first click on the canvas locks.
  - There is no collision, gravity or vertical movement: the camera passes through walls and
    floors and stays at eye height, so upper storeys are out of reach.
  - Escape, releasing pointer lock, choosing another view or changing the model ends walk mode
    and returns the previous view exactly, including the Top view's framing. If the browser
    refuses pointer lock, walk mode stays: the prompt remains and the keys still move.
  - Snapshots ignore walk mode: with `?snapshot=1&walk=1` the requested snapshot camera renders
    as usual, with no prompt and no walk input, so the 3D PNGs stay deterministic.
- Snapshots (`?snapshot=1`) show the IFC's own colours apart from the stair readability presentation,
  so the 3D PNGs still check what other viewers will show for everything but the stair recolour.
  `?style=ifc` or `?style=plan` in the URL forces a style.
- `npm run view` runs the same app for interactive use. It reloads the page whenever an IFC in
  `out/` changes.
