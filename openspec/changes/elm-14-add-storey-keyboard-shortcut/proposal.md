# Proposal

## Why

Comparing floors in the viewer means reaching for the "Up to:" selector in the bar every time, which
costs a trip across the screen and a dropdown. Stepping through the floors is something you do
repeatedly while looking at the same view, so it should be one key press that leaves your eyes and
the camera where they are.

## What Changes

- Add a keyboard shortcut to the viewer: **PageUp** shows the next storey up and **PageDown** hides
  the topmost shown storey, moving the storey selector one floor at a time with the same effect as
  choosing that floor from the dropdown.
- The shortcut stops at the ends. PageUp with the topmost storey already shown, and PageDown with
  only the lowest storey shown, do nothing; they never wrap round.
- The shortcut is ignored with a modifier key held, when a model has a single storey (the selector
  is hidden), in snapshot mode, and while any form control other than the storey selector has
  focus. While the storey selector itself has focus the shortcut still steps it, in place of the
  browser's own PageUp/PageDown behaviour for a select, so the two never both act.
- Holding the key does not run away: auto-repeat is ignored, and a key press that arrives while a
  step is still being drawn is ignored too.
- The storey selector's tooltip names the keys so the shortcut can be found.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ifc-viewer`: a keyboard shortcut that steps the storey selector.

## Impact

- `viewer/main.ts`: one keydown handler beside the walk and measure ones, reusing `chooseStorey()`.
- `viewer/index.html`: the selector's tooltip.
- `tests/plan-vs-3d.test.ts`: key presses in the existing "storey selection" tests.
- `docs/rendering.md`: the viewer section lists the shortcut.
- No schema, model, pipeline or dependency change.
- Out of scope: showing a single floor in isolation (the selector stays cumulative), wrapping,
  Home/End to jump to the ends, and a shortcut for walk mode's own floor changes.
