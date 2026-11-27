# Rendering

`npm run render <model>` produces two kinds of image:

| Output                                  | Drawn from       | Code                                                     |
| --------------------------------------- | ---------------- | -------------------------------------------------------- |
| `out/<name>.<storey>.plan.svg` / `.png` | the model (JSON) | `src/shared/render/plan.ts`, `src/backend/render/png.ts` |
| `out/<name>.3d-{sw,se,ne,nw,top}.png`   | the IFC file     | `src/backend/render/snapshot3d.ts`, `src/frontend/`      |

Look at the PNGs after every change. They are the quickest way to catch something the checks
don't, such as a door swinging the wrong way.

## Plans

One SVG per storey, at 1 px = 10 mm in the SVG and rasterised at 2× to PNG. Like a site location
plan, the sheet is turned by `site.northAngle` so true north points up, and it is sized to the
turned drawing. Text stays horizontal and dimension figures read along their lines. A model with no
north angle draws with plan +y up. The plan is drawn in this order:

1. slab fill, cream (the ground colour for `material: "ground"`) with a dashed outline
2. room fills (the same cream, on top of the slab)
3. walls at their true thickness, split around the openings. Beside a window with a splayed
   reveal the wall ends square from one face to the middle, then at the reveal's angle to the
   splayed face (`src/shared/geometry/opening.ts`)
4. door leaves with swing arcs (inset by the door's frame), and window symbols (outline, two
   glazing lines, and a small block for each frame piece or glazing bar the cut passes through:
   jambs and vertical bars). A splayed window's outline, and the dashed outline of one the cut
   misses, follow its reveal. A doorway has no leaf or swing: its wall pieces leave the opening.
5. railings: a line from start to end with a tick at each derived post, in the railing colour
6. stairs, drawn in full rather than cut: each flight's footprint, a tread line per tread and a
   walking-direction arrow, and each landing's outline. The cut height only decides which openings
   are cut, so a half landing above it is drawn like any other geometry
7. room labels (name and area in m²) and room dimensions: the longest clear wall-to-wall span
   along plan x and along plan y of the room's `dimensionOutline` when it has one (otherwise its
   `outline`), in mm, drawn as dimension lines inside the room and kept clear of the label where
   the room is wide enough
8. element ids in red, only with `--ids`
9. overall dimensions, along plan x and plan y
10. title, north arrow and a 5 m scale bar

Every element is an SVG group with `class` (`wall`, `door`, `window`, `room`, `room-dimensions`,
`slab`, `railing`, `stair`, `stair-flight`, `stair-landing`) and `data-id` set to its model id, so
the SVG can be inspected or queried. A stair's flights and landings are groups nested inside the
stair's.

Railings and stairs are drawn by `renderPlan` alone. `renderFloor`, `renderWallTops` and
`renderPlanAnnotations`, which the viewer composites into its plan-style overlay, draw neither, and
their drawing extent stays clear of outlying railings. For readability the viewer recolours the
stair solids in every viewer mode including snapshots — cream / darker-cream tread bands and an
edge outline. The base IFC stair colour stays classifier-safe; the recolour is presentation only.
Railings keep their IFC slate colour. Both colours stay clear of the wall, room and paper colours
the plan-versus-3D comparison classifies (`src/shared/render/style.ts`).

Drawing style is all in one place: `src/shared/render/style.ts` holds the scale, colours, font and
margins.

### Determinism

- Numbers are written with one decimal place.
- Fonts are the bundled DejaVu TTFs (`dejavu-fonts-ttf`), and resvg is told not to load system
  fonts.

So the PNG is identical on every machine. `tests/render.test.ts` snapshot-tests the cottage's
SVG in `tests/__snapshots__/`.

## Colours

The plan's colours are `C` in `src/shared/render/style.ts`. The viewer draws the same colours in plan
style, so they have three jobs, and a new one must be chosen for all three:

- **The plan-versus-3D comparison.** `tests/support/plan-vs-3d.ts` classifies each pixel as wall,
  room or paper, within 5 per channel of `C.wall`, `C.room` or `C.paper`, and compares only those
  pixels. A colour that matches none of the three is ignored, as stair, ground and railing pixels
  are (`isIgnoredColour`). So a new element's plan colour is either one of those three, because it
  should be compared, or clear of all three. Never near one by accident: a pixel that is nearly
  wall colour is wrongly compared. Storeys with pitched walls, or walls under 2 m across, are
  skipped altogether (`comparable` in `tests/support/plan-compare.ts`).
- **The viewer's own recolouring.** A stair and a railing keep their IFC colours for the viewer to
  recognise ([IFC output](ifc.md#colours)), and only the stair is recoloured on top of it.
- **Diff mode.** Added, changed and removed elements take the diff's greens, yellows and reds (see
  the table under [The viewer](#the-viewer)), so a colour near those reads as a change that is not
  one.

## 3D snapshots

`render` starts the viewer (below) on a free port, opens it in headless Chromium through
Playwright, and saves a 1200 × 900 PNG for each of five cameras:

- `sw`, `se`, `ne`, `nw`: perspective views from each plan corner, looking down. The names are plan
  corners whatever `site.northAngle` is, so a file keeps showing the same corner.
- `top`: an orthographic plan view, true north up like the plan sheets

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

To see a viewer state from a script, headless, use the
[inspect-the-rendered-output](../.agents/skills/inspect-the-rendered-output/SKILL.md) skill: it has a
recipe and a table of the URL parameters below.

`src/frontend/` is a React 19 app built by Vite. React renders the toolbar, pickers, hints,
measurement list, changes panel and compass from `src/frontend/state/store.ts`; the imperative
engine in `src/frontend/scene/engine.ts` owns the three.js/ThatOpen scene and publishes discrete
state to the store. `npm run view` serves the dev build, `npm run viewer:build` writes `dist/`, and
`npm run viewer:preview` serves that build with the same `/models.json`, `/out/*` and `/wasm/*`
routes.

- `src/frontend/vite/vite.config.ts` serves `/models.json` (the IFCs in `out/`), `/out/*` and the web-ifc WASM
  from `node_modules`, so nothing comes from a CDN. `ELMSTEAD_OUT_DIR` serves another folder in
  place of `out/` (the tests use it). Requests are confined to those directories; traversal,
  sibling-directory prefixes and malformed percent-encoding return 404. It reloads on `change`
  and `add`, so an atomic IFC rename is noticed too.
- `scene/engine.ts` loads the IFC through ThatOpen's IFC loader and sets up the camera views.
  - In the scene Y is up and plan north is −Z.
  - The four corner buttons show true isometric views: an orthographic camera from a plan corner,
    45° round and 35.26° above the ground, so parallel edges stay parallel and the building reads
    like a video-game diorama. Each button is labelled with the nearest of the eight compass points
    to the true direction it looks from (`site.northAngle`), and its tooltip names the plan corner:
    elmstead's `sw`, `se`, `ne` and `nw` read N, W, S and E. With no north angle they read SW, SE,
    NE and NW. The Top view is orthographic straight down, turned so true north is up the screen,
    like the plan sheets. Snapshots keep the perspective corner cameras (see
    [3D snapshots](#3d-snapshots)).
  - The loader keeps IFC coordinates as they are (`COORDINATE_TO_ORIGIN: false`), so anything
    drawn from the model lines up with the IFC.
  - Every model is drawn as full geometry (`setLodMode(LodMode.ALL_VISIBLE)`). By default
    Fragments draws items it judges small on screen as lines, and thin parts such as glazing bars
    and window frames qualify even close up.
  - `?view=` accepts only `sw`, `se`, `ne`, `nw` and `top`; any other value falls back to `top`.
    The corner values are plan corners, whatever their buttons read.
  - `?orient=project` ignores `site.northAngle` when orienting the views: the Top view keeps plan +y
    up and the corner buttons keep their plan names. The compass still points to true north. The
    plan-versus-3D test uses it, because its comparison aligns walls with pixel rows and columns.
    The model picker is built with `textContent`, so a file name containing markup is shown
    literally.
  - `?camera=px,py,pz,tx,ty,tz` places a perspective camera at p looking at t, in the scene's
    metres (Y up, IFC +Y along −Z), for close-ups such as one window.
  - With `?snapshot=1` in the URL it hides the toolbar and sets `window.__elmsteadReady` once the
    frame is drawn, which is what the snapshot driver waits for.
- Hover identification: the **Ids** button or `?ids=1` (off by default, ignored in snapshots)
  shows a constraint-style haloed label at the hovered point with the model id and name of the
  element under it, drawn above everything like the measurement readout. `src/frontend/scene/identify.ts` maps each fragments item's `Tag`/`Name`/`LongName` to
  that label — the same ids the model code and checks use — and `scene/engine.ts` raycasts on
  pointermove, one pick in flight. It is passive: clicks still measure and drags still navigate.
  The label hides while dragging, while the camera moves and throughout walk mode, and follows
  the storey selector, since the raycast skips hidden items.
- Room labels: `scene/engine.ts` also reads `out/<name>.building.json` and draws each storey's room
  labels at its ceiling, 10 mm above the top of its tallest wall (the schema has no ceiling
  height). Being above the walls, they read from every camera that can see that storey.
  - The plan's own room and overall dimension lines (`renderPlanAnnotations` in
    `src/shared/render/plan.ts`) lie flat at the ceiling, as if on a glass ceiling. Lying flat is what lets
    a storey above occlude them; camera-facing billboards painted through floors.
  - Room names, areas and ids sit on small flat planes at the same ceiling, one per room, and each
    yaws about its room's centre to follow the camera (`updateLabelOrientation` in
    `src/frontend/scene/engine.ts`), so the text reads left-to-right across the screen from any view while
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
- The plan overlays (floors, wall tops and dimensions) are drawn as scene geometry, not as images
  of the plan (`src/frontend/scene/overlay.ts`). `renderFloor`, `renderWallTops` and `renderPlanAnnotations`
  return the drawing's primitives (polygons, polylines, lines and text, the same nodes their SVG
  is written from), and the viewer draws them in the SVG's order:
  - fills as flat, unlit meshes in the plan's colours;
  - strokes and dashes as lines whose width and dash lengths are in world units at the plan's
    scale (1 px = 10 mm), so a 0.8 px window outline is an 8 mm line;
  - dimension figures as small flat haloed text planes, at the plan's size and rotation.

  Consecutive primitives that draw alike share one mesh or line object. The overlays stay sharp
  at any zoom, and the only textures are small text labels, so texture memory follows the amount
  of text, not a storey's footprint. A browser test holds every uploaded texture to 1024 × 1024
  texels at most.

- Plan colouring, the same in every view (`applyStyle` in `scene/engine.ts`):
  - Floors are the plan's own floor fills and door swings (`renderFloor` in `src/shared/render/plan.ts`),
    slab fills (cream, or the ground colour for a ground slab) and room fills, one layer per shown
    storey at that storey's level. The slab
    fill covers floor outside the room outlines too, such as bay windows and alcoves. Each floor
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
- The model picker lists each model in `out/` once. A revision's outputs are named
  `<model>@<revision>` (see [Revisions](modelling.md#revisions)), and the **revision picker** beside
  the model picker lists **Existing** (the base model) and then the model's built revisions by name.
  It is hidden for a model with no revisions. **Existing** is disabled when only revisions have been
  built, and choosing such a model opens its first revision.
  - The choice is written to `?model=`, as `<model>@<revision>` or just `<model>` for Existing, so
    `?model=elmstead@rear-extension` opens a revision directly with both pickers set.
  - Switching revision loads it in place and keeps the view: the camera, projection, shown storeys
    and Ids toggle stay as they are, so you can flick between versions from one viewpoint. `?view=`
    and `?camera=` apply only when a model is first opened. The view buttons frame the revision's
    own extent. The previous revision stays on screen while the next one loads (the renderer
    pauses), so the switch shows no blank or half-styled frames. Each revision stays loaded once
    shown, so flicking back to one is close to instant; choosing another model releases them. Measurements are cleared and walk
    mode ends, as for a model change.
  - **Arrow Right** and **Arrow Left** step the revision picker, skipping a disabled Existing and
    stopping at either end. They work while any of the bar's pickers has focus, in place of the
    browser's own arrow keys for that picker, and are ignored where the storey shortcut is, and
    for a model with no revisions.
- **Diff** (shown only for a revision; `D`, or `?diff=1`) colours what the revision changes against
  Existing, in GitHub's diff colours, a pale fill with a dark outline of the same hue:

  |         | Fill      | Outline   | Floor     |
  | ------- | --------- | --------- | --------- |
  | added   | `#aceebb` | `#1a7f37` | `#e6ffec` |
  | changed | `#fae17d` | `#9a6700` | `#fff8c5` |
  | removed | `#ffcecb` | `#cf222e` | —         |
  - **In 3D:** added and changed elements take the fill, with outlines along their edges. Glazing
    stays see-through. Removed elements are drawn from the base model as see-through ghosts where
    they stood. Unchanged elements keep their normal colours.
  - **In the plan drawing**, so the diff shows from the top too:
    - added and changed wall pieces are in the dark colour, and window symbols and door gaps in the
      fill;
    - floor the revision built is tinted pale green, and floor it took away pale red, the subtler
      tint, as a diff line's background is subtler than its changed words. This compares each
      storey's whole floor (its slabs and rooms together), so floor that only changes room, as in a
      knock-through or a moved partition, has no tint. Door swings are still drawn over the tints;
    - added slabs and rooms are outlined in dark green, and changed ones in bright yellow, which
      shows against the walls the outline runs along;
    - removed walls and openings are drawn from the base in pale red with a dashed red outline.
  - **The changes panel** gives each category's count, with a checkbox to hide it, and lists the shown
    storeys' changes. Clicking one frames it.
  - **Hovering** with **Ids** on adds the status to the label, for example `wall-lean-to-north · added`.
  - **Missing base:** if the base model's IFC hasn't been built, there are no ghosts, and the status
    line says so. Without its JSON there is no diff at all.

  Diff stays on across revisions of a model, is inactive on Existing, and never moves the camera.
  What counts as a change is in [the diff](modelling.md#what-a-revision-changes-the-diff).

- **Transparency** (`?xray=1`) draws elements see-through, on any model, Existing included: an X-ray
  of the building. With Diff on, it fades only the unchanged elements, so the changes stay solid. In
  plan style it fades the plan drawing too, so it also works from the top. It stays on across model
  and revision switches.
- Each Diff, Transparency or panel change lands in one picture: the previous picture stays drawn
  until the new one is complete, as for a revision switch.
- The **Up to:** selector lists the model's storeys lowest first; choosing one shows that storey and
  every storey below it, hiding those above, and the topmost choice shows everything. A choice
  updates the loaded model in place without moving the camera, so floors compare from one viewpoint;
  the compass follows the shown footprint, and the view buttons re-frame on request. The choice is
  written to `?storeys=` so the URL shares it. A choice eases to the new floor with a short section
  sweep; choosing again while it runs retargets the sweep from where it is. A `?storeys=` set that
  is not one floor's prefix shows a disabled **Custom** value until a floor is chosen. The selector
  is hidden for a single-storey model.
- **Arrow Up** and **Arrow Down** step that selector one floor: up shows the next storey above the
  highest one shown, down hides the highest one shown. They stop at the first and last floor rather
  than wrapping, and from a custom set they step from its highest storey. Holding either key keeps
  stepping at the auto-repeat rate. They are ignored in walk mode (where the arrows walk), in
  snapshots, with a modifier held, and while a form control other than the storey selector has
  focus.
- `?storeys=a,b` shows only those storeys: everything the IFC contains or aggregates in the others is
  hidden, with their labels and floor planes. An id that names no storey is noted in the status line
  and ignored; omitting the parameter shows every storey. With one storey shown, the Top view is
  that storey's plan view, whichever storey it is.
- Navigation (`setNavigationInput` in `scene/engine.ts`), map-style in every view:
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
