# Proposal

## Why

The viewer gets slower as the Elmstead model grows. Profiling the viewer on the current model found
the cause in its plan-style overlays: each storey's floor fills, wall tops and dimensions are SVG
drawings rasterised into storey-sized canvas textures at 2.5 mm per texel. That makes 16 textures
of 4300–5600 px a side, about 1.34 GB before mipmaps, for a 146 KB IFC. On a weak GPU (SwiftShader)
uploading them adds about 4.5 s to the load, and the stacked transparent planes double the GPU time
per frame (19.5 ms against 8.8 ms without them). Each texture grows with the storey's footprint, and
their number grows with storeys and wall heights. The drawings are only flat-colour polygons, lines
and text, so they can be drawn as geometry.

## What Changes

- The plan's overlay drawings (`renderFloor`, `renderWallTops`, `renderPlanAnnotations`) are built
  as a tree of drawing primitives in `src/render/`: polygons, polylines, lines and text, each with
  its fill, stroke, stroke width and dash. The SVG writer serialises that tree, so there is one
  source for the plan and the viewer. `renderPlan` uses the same primitives and its SVG stays byte
  for byte the same.
- The viewer draws those primitives as three.js geometry instead of rasterising the SVG:
  - fills as flat, unlit meshes;
  - strokes as world-width lines, so a stroke is as wide as on the plan at the plan's scale;
  - dashes as dashed lines;
  - dimension figures as small per-label text planes, like room labels today.
- The overlays stay where they are: the floor at its storey's level, still hiding the storeys
  below; the wall tops 5 mm above each flat wall height; the dimensions at the ceiling. The
  plan-versus-3D comparison still passes.
- The annotation overlay's lines and text halo, which a `<style>` rule sets today, become explicit
  per-primitive styles. The annotation SVG renders the same.
- A viewer test bounds the size of the textures the viewer uploads, so storey-sized textures cannot
  come back.

Out of scope:
- Removing the wall-top poché, which the wall-top shader may already paint. Worth checking
  separately.
- Changing what the overlays show, or the room, constraint, measurement and hover labels, which
  are already small textures.
- The 3D snapshots, which run in IFC style with labels off and draw no overlays.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plan-rendering`: a new *Overlay drawings as primitives* requirement. The overlay drawings are
  available as drawing primitives, and their SVG is serialised from the same primitives. The plan's
  own SVG is unchanged.
- `ifc-viewer`: a new *Plan overlays as geometry* requirement. The plan-style overlays are drawn as
  geometry at the plan's scale, not as storey-sized raster textures, and the textures the viewer
  uploads stay small. *Plan style* and *Floors stack occlusively* keep their behaviour.

## Impact

- `src/render/svg.ts`: the element helpers return primitive nodes, and a serialiser writes the SVG.
- `src/render/plan.ts`: the drawing functions return nodes instead of strings. The overlay
  functions return the nodes and bounds as well as the SVG. The annotation styling becomes
  explicit.
- `viewer/`: a new module turns primitives into three.js objects. `viewer/main.ts` uses it in
  place of `planPlane` for the floor, wall-top and annotation layers. `labelTexture` is reused for
  dimension figures.
- Tests: existing SVG content tests and the plan snapshot keep passing unchanged. New tests cover
  the serialiser round-trip, the primitive-to-geometry mapping, and the texture-size bound. The
  plan-versus-3D and storey tests guard the look.
- No schema, IFC or dependency changes. `three/addons` already ships `Line2` and dashed lines.
