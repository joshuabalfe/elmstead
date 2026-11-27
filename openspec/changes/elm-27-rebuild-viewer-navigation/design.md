# Design

## Context

See `proposal.md` — Why. The viewer is React 19 on Vite, with an imperative ThatOpen/three.js engine
behind one external store; its controls are hand-built HTML in `Toolbar.tsx` and plain CSS. The
existing `?view=` values and the snapshot camera names include the plan corners `sw`, `se`, `ne` and
`nw`; those values must keep working even though the visible camera controls change. The viewer tests
run in Chromium against the real DOM and already read `#storeys`, `#diff`, `#xray`, the
`data-view` attributes and the `window.__elmstead*` hooks.

The model schema has no statement of which side is the building's front. `site.northAngle` only
turns true north, so a flat elevation cannot know that Elmstead's front wall faces plan west rather
than plan south.

The implementation landed in PR #77. This change records the behaviour and design so the work stays
traceable and the main specs are updated through the normal archive step rather than by editing
them directly.

## Goals / Non-Goals

**Goals:**

- One control language for the rail: grouped sections, labels on the left and controls on the right,
  switches that read their own state, and disabled controls that stay visible.
- Keep the rail compact enough for the camera pads and tools without scrolling at normal window
  heights.
- Make every camera snap mean what its label says: true north for N/W/E/S, and the building's own
  front for Front/Back/Left/Right.
- Preserve existing links and snapshots: the plan-corner ids stay valid and the 3D snapshot PNGs
  keep their corner cameras.
- Keep the schema change optional, so every existing model and generated output remains valid.

**Non-Goals:**

- Changing the 3D engine, ThatOpen, the renderer or the plan drawings.
- Redesigning the measurement list, changes panel, compass, hints or status line.
- A general design system or a mobile navigation pattern.
- Making the flat elevations follow `northAngle`; they are building-relative, not compass views.
- A hosted deployment or a new build step.

## Decisions

### Blueprint Core for the rail

Use `@blueprintjs/core` 6.23.3 and `@blueprintjs/icons` 6.17.0, pinned exactly, with their CSS
imported once in `main.tsx`. The switch, slider, select and button components provide the keyboard
and focus behaviour the hand-built controls lacked, and one visual language for the whole rail. The
dependencies are build inputs for the private viewer, so they stay in `devDependencies` beside React,
three.js and ThatOpen. Blueprint's CSS variables and light theme already work against the viewer's
white rail.

Alternatives considered: extending the hand-built HTML (the current problem is per-control bespoke
styling and inconsistent states); a different component library (no benefit for this small a UI and
a second design language); a headless component library (more custom styling for no functional gain).

### Switches for settings, buttons for actions

Labels, constraints, ids, transparency and diff are persistent settings: they use a Blueprint
`Switch` with the label on the left and the control on the right, and the track reads the state
(`Off` / `On`) rather than an action (`Show` / `Hide`). Measure, Clear, Walk and the camera snaps
are actions and stay buttons. Disabled controls stay in the rail, so the user can see that a control
exists even when the current model or revision cannot use it. The revision picker and Revision Diff
are disabled rather than hidden when there is no revision; a single-storey model shows a disabled
Levels slider. This follows the project's rule that unavailable controls stay visible.

The switch input is visually hidden by Blueprint but remains the labelled form control. Browser
tests must click the label (`label:has(#diff)`), not the input, which is covered by another element;
this is a test-harness change, not a UI compromise.

### Vertical Levels slider in the right-hand control column

A Blueprint vertical `Slider` keeps the one-notch-per-storey model and gives the level names a
`labelRenderer`. The notches stay clickable spans carrying `data-storey`, the handle carries an eye
icon, and the selection still writes the same `?storeys=` prefix. Up and Down step the slider; a
notch click and a drag both apply the same engine command, and the storey sweep/retarget behaviour
is unchanged.

Blueprint puts a vertical track at the left and its labels to the right. The rail's toggles put
their controls on the right, so CSS flips the slider: the track and handle are positioned at the
right, the notch labels get a fixed column width and are right-aligned against their ticks, and the
label column ends just before the track. This makes the slider read as the control beside the level
names rather than a detached block on the left. The widths are tied to the fixed 248 px rail; the
`--viewer-nav-width` variable is the single place to revisit if the rail changes.

The slider is the selector for a single storey, so its value is a prefix of the model's storeys.
`?storeys=` keeps its existing parsing and custom-set behaviour. Arrow handling stays in the engine
hook, with the focus guard narrowed to text fields, selects and textareas so a focused switch or
slider does not swallow the shortcut.

Alternatives considered: keeping the native select (compact but not a visible multi-storey control,
and it hides the levels behind a popup); a custom list of buttons (loses drag and the
one-control/one-value semantics); a horizontal slider (does not fit the rail's vertical stack and
reads like a volume control).

### Two camera pads, one view model

The visible camera controls become two small pads:

- a cross of flat elevations: Front at the bottom, Left and Right at the sides, Back at the top,
  with Top in the centre;
- a cross of true-north isometric snaps: N above, W and E at the sides, S below, with an empty
  centre.

`src/shared/render/views.ts` gains `CARDINALS` (`n`, `e`, `s`, `w`), `ELEVATIONS`
(`front`, `back`, `left`, `right`) and the `CameraView` union, while `VIEWS` keeps the plan-corner
ids for snapshots and links. `parseView` accepts all of them, defaulting to Top. `cameraForView`
takes `northAngle` and `frontAngle`:

- the N/E/S/W directions rotate the plan direction by `northAngle`, keeping the 35.26° isometric
  elevation and the orthographic projection used by the corner snaps;
- Front/Back/Left/Right use the front's outward vector from `frontAngle` (default 180°, plan
  south); the other three are its opposite and perpendiculars, as seen facing the front;
- Top keeps its true-north-up orientation; the corner views keep their existing camera math.

The engine reads `northAngle`/`frontAngle` with the building JSON, publishes labels for the pads,
and resets them when another model loads. The labels stay N/W/E/S even when the model is turned;
only the direction they look from turns. `?orient=project` continues to force the plan orientation
for every snap, including the cardinals.

Alternatives considered: label the four plan-corner views with compass names (the previous design —
labels change with the model and the same label can mean different views); derive the front from the
building geometry (no reliable signal in the schema); add separate buttons for all eight compass
points (the rail cannot hold them without becoming a compass widget, and the flat views are more
useful for elevations).

### `site.frontAngle` as optional metadata

`SiteSchema` gains `frontAngle: DegSchema.optional()`, the front's outward direction
counter-clockwise from plan +y, defaulting to 180 (plan south). The JSON Schema is regenerated. The
default matches the original plan-south assumption, so every model without the field keeps today's
flat views; Elmstead sets 90 because its front wall faces plan west, and the example cottage sets 180. This is authoring metadata, not derived geometry: a building's front is an architectural fact
that cannot be recovered reliably from walls and openings.

### Keep the compact layout, within accessibility limits

The camera snaps use small solid buttons rather than minimal ones, because minimal buttons were hard
to see on the white rail. The compact size keeps the two pads inside the camera section; the labels
stay full words so the pads remain readable without tooltips. This is a desktop tool, so the 20 px
target is deliberate; the size is a single CSS rule and can be raised if touch use becomes a
requirement. Text labels and `title` tooltips remain for every snap, and the switch labels carry the
full setting names.

## Risks / Trade-offs

- **Blueprint's hidden checkbox inputs break direct test clicks** → Browser tests click the labelling
  element (`label:has(#id)`); this is documented in the test helpers and all viewer suites use it.
- **Blueprint's vertical slider layout is not the rail's layout** → The flip is isolated in a few
  `#bar .storey-slider` rules; the slider's drag math is vertical-only, so moving the track
  horizontally does not affect selection. The notch and drag paths remain covered by browser tests.
- **The compact controls are harder to hit** → Full-word labels and tooltips stay; the size is
  controlled by one rule. The rail is a desktop control surface, not a touch UI.
- **`frontAngle` can be omitted or wrong** → The default preserves existing behaviour, and the
  elevations are explicitly building-relative. Elmstead's orientation test pins its 90° value;
  docs explain the field.
- **Adding view ids changes the URL surface** → Corner ids remain valid and snapshot camera names
  are unchanged; `?view=` validation accepts the new ids and still defaults unknown values to Top.
- **Blueprint adds bundle size and markup depth** → The viewer already loads three.js and ThatOpen;
  the rail is a small part of the payload. The packages are pinned exactly.
- **The spec was edited in place before this change existed** → This change restores the main specs
  and carries the new requirements as deltas; the archive step syncs them. Until then, the change is
  the authoritative description of the new behaviour.

## Migration Plan

The implementation is already in PR #77. Merge it with this change, then archive the change to sync
the deltas into `openspec/specs/`. The schema field is optional, so no model migration is needed;
existing `?view=` links and snapshot names keep working. Rollback is a revert of the viewer commits:
the old rail returns, the new view ids stop being accepted and `frontAngle` becomes unused, while
existing models and outputs remain valid.

## Open Questions

None. The remaining work is review and the normal archive step.
