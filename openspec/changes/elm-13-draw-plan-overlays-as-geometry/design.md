# Design

## Context

See proposal.md for why. Today:

- `src/render/svg.ts` builds SVG strings with `polygon`, `polyline`, `line`, `text`, `group` and `el`.
  `src/render/plan.ts` concatenates those strings. `overlay()` wraps them in an `<svg>`, sized from
  `makeView` (the storey extent plus `MARGIN`), and returns `{ svg, bounds }`. `bounds` is the plan
  area in mm that the SVG covers edge to edge.
- Every coordinate in `plan.ts` is already in SVG px (`view.toPx`: 1 px = 10 mm, y down). Offsets,
  ticks and font sizes are in px too.
- `viewer/main.ts` `planPlane()` rasterises each overlay SVG at `LABEL_RESOLUTION = 4` onto a
  canvas and lays it on a plane. The layers are:
  - the annotations (`renderOrder` 1, transparent, `depthWrite` false), at the ceiling;
  - one wall-top layer per flat-wall height (transparent, `depthWrite` false), 5 mm above that
    height;
  - the floor (`alphaTest` 0.5, so it is in the opaque pass and writes depth, `renderOrder` −1), 20 mm
    above the storey's elevation.
- The annotation overlay's `<style>` makes every `line` ink at 1 px and gives `text` a 3 px paper
  halo, overriding the presentation attributes that `dimension()` writes.
- `plan.ts` itself only draws polygons, polylines, lines and text, plus `rect` and `circle` in the
  plan sheet's scale bar and north arrow. The overlay SVGs contain no `rect`, `circle` or `path`.

## Goals / Non-Goals

**Goals:**
- One source for the drawing: the plan and the viewer read the same primitives.
- The plan SVG is byte-identical. This proves the refactor changes nothing for the plan.
- Overlay GPU memory proportional to the text, not the footprint, and no overdraw outside the
  drawn shapes.

**Non-Goals:**
- Changing what any overlay contains or where it sits.
- Merging the per-height wall-top layers, or dropping the wall-top poché.
- A general SVG renderer: only the primitives `plan.ts` emits are supported.

## Decisions

### 1. Primitive nodes replace strings, with coordinates kept in SVG px

The `svg.ts` helpers keep their signatures. They return a node instead of a string:

```ts
type Node =
  | { tag: "polygon" | "polyline"; points: Vec[]; attrs: Attrs }
  | { tag: "line"; from: Vec; to: Vec; attrs: Attrs }
  | { tag: "text"; at: Vec; text: string; attrs: Attrs }
  | { tag: "g"; attrs: Attrs; children: Node[] }
  | { tag: "rect" | "circle" | "style"; ... }; // plan sheet only, via `el`
```

`serialise(node)` writes exactly the string the helper wrote before: same attribute order, same
`num()` rounding. The changes in `plan.ts` are then mostly type changes (`string[]` → `Node[]`), and
byte-identical output can be checked against the plan snapshot. `Attrs` gets typed keys for the
attributes the viewer reads (`fill`, `stroke`, `stroke-width`, `stroke-dasharray`, `font-size`,
`font-weight`, `text-anchor`, `transform`), plus an open index for `class` and `data-*`.

The coordinates stay in SVG px, with the overlay's `bounds` alongside. The viewer maps px to plan mm
by `x = bounds.minX + px.x / PX_PER_MM` and `y = bounds.maxY − px.y / PX_PER_MM`. Primitives keep
full precision. Only the SVG is rounded to 0.1 px.

*Alternatives:*
- Primitives in plan mm. This would mean rewriting every px-based offset in `dimension()`, ticks
  and labels, and would put byte-identity at risk for no gain.
- Parsing the SVG in the viewer with `SVGLoader`. This was rejected in favour of typed primitives:
  it doesn't handle dashes or text, and it adds a parse step.

### 2. The overlay functions return primitives as well as SVG

`renderFloor`, `renderWallTops` and `renderPlanAnnotations` return `{ svg, bounds, nodes }`. `svg`
is `serialise` over the wrapped nodes. Existing tests that read `.svg` keep working.

### 3. Annotation styling becomes explicit

`dimension()` takes an optional style: line stroke and width, and text halo. The plan passes
nothing, so its output is unchanged. `renderPlanAnnotations` passes ink at 1 px with a 3 px paper
halo, which is what its `<style>` rule produced, and drops the `<style>` node. Its SVG renders the
same, but its bytes change. No snapshot covers it.

### 4. Viewer mapping (`viewer/overlay.ts`)

A pure builder, `overlayGroup(nodes, bounds, y, layer)`, walks the nodes in order and returns a
`THREE.Group`. It merges consecutive primitives that share a material into one *run*. Painter order
is kept between runs, and draw calls stay at a few dozen per layer.

- **Fills** (`fill` not `none`): triangulate with `THREE.ShapeUtils.triangulateShape`, lay the
  triangles in the XZ plane at height `y`, and merge each run into one `BufferGeometry` with an
  unlit `MeshBasicMaterial` in the sRGB colour. Use `DoubleSide`, so winding doesn't matter.
- **Strokes** (`polyline`, `line`, a stroked `polygon` closed back to its start):
  `LineSegments2` + `LineMaterial` with `worldUnits: true`, and
  `linewidth = stroke-width / PX_PER_MM / 1000` m. With `stroke-dasharray`, `dashed: true` sets
  `dashSize` and `gapSize` from the dasharray in the same scale, after `computeLineDistances()`.
  `LineSegments2` sets each material's resolution in `onBeforeRender`.
- **Text**: one flat plane per figure, using the `labelTexture` that the room labels already use
  (moved out of `main.ts` so `overlay.ts` can share it). The plane is positioned at the anchor with
  the baseline offset applied, and turned by the `rotate()` in `transform`. SVG's clockwise screen
  angle becomes a negative yaw about +Y. Unlike room labels, figures do not follow the camera,
  because they are part of the drawing.
- **Layers**: the `layer` argument picks the depth treatment:
  - `floor`: opaque and `depthWrite: true`. Each run gets the next `renderOrder` (from −1 down) and
    a stepped `polygonOffset` (units −1, −2, …), so coplanar runs keep painter order without
    z-fighting and still hide the storeys below.
  - `overlay` (wall tops, annotations): `transparent`, `depthWrite: false`, with fractional
    `renderOrder` steps inside the layer's current value (0 for wall tops, 1 for annotations), so
    the layers still sort as they do now.

`overlay.ts` also returns a `dispose()` that frees its own geometries, materials and textures.
`loadLabels`' generic `dispose` skips `Line2` materials, because the constraint lines share one
material.

### 5. Guarding against regression

The texture bound in the spec is checked in a browser test. An init script wraps
`texImage2D`/`texStorage2D`, the viewer loads `elmstead` in plan style with labels on, and the test
asserts that no upload exceeds 1,048,576 texels. The plan-versus-3D test is the visual guard.

Two scripts in `scripts/` measure the change, but they are not tests:
- `bench-viewer.ts` gives performance numbers as JSON. It runs on SwiftShader by default, because
  its numbers compare well run to run, with a real GPU optional.
- `compare-viewer.ts` gives side-by-side screenshots and diff heatmaps at fixed views from two viewer
  roots.

Timings and antialiasing differences vary too much to assert on in `npm test`. The baseline comes
from `origin/main` checked out in a temporary worktree.

## Risks / Trade-offs

- [Lines thinner than a pixel (for example 7 mm strokes in a zoomed-out view) shimmer or vanish,
  where the mipmapped texture blended them faintly.] → Check top and corner views by eye. If needed,
  give `LineMaterial` a minimum on-screen width by switching to pixel widths derived from the
  camera's zoom on each camera update. That stays inside `overlay.ts`.
- [`LineSegments2` draws no joins, so a stroked polygon's corners show tiny notches.] → At 8 mm
  strokes they are below a pixel at normal zoom. Accepted.
- [Coplanar floor runs could z-fight on some GPUs despite `polygonOffset`.] → The plan-versus-3D test
  and a corner-view eye check on Metal and SwiftShader. Fallback: lift each run 0.1 mm.
- [Annotation SVG bytes change (the style becomes explicit).] → The SVG looks the same, and nothing
  snapshots it. The plan SVG, which is snapshotted, is unchanged.
- [More draw calls: about 30–60 per layer instead of 1.] → They are tiny, and a few hundred in total
  is well within budget. The measured overdraw saving outweighs them.

## Migration Plan

The change is internal to the pipeline and viewer, so there is nothing to migrate. To roll back,
revert the commit.

## Open Questions

- Whether the wall-top poché is redundant with the wall-top shader, in which case only the door gaps
  and window symbols would remain. This is a follow-up and doesn't affect this change.
