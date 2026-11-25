# Design

## Context

The storey selector (ELM-6) is cumulative: choosing a storey shows it and every storey below it.
`chooseStorey(topId)` in `viewer/main.ts` already does everything a step needs: it writes
`?storeys=`, repopulates the selector, hides and shows the storeys' fragments and drawings, moves
nothing in the camera and awaits the redraw. The keyboard has two global handlers today: walk mode's
W/A/S/D and arrow keys plus Escape, and measure mode's Escape. The arrow keys are taken in walk mode,
which is why they are not used here.

## Goals / Non-Goals

**Goals:**
- One key press moves the selection one floor, reusing `chooseStorey()` so the shortcut and the
  dropdown cannot drift apart.
- Never surprising: no wrapping, no key-repeat runaway, no clash with the selector's native keys.

**Non-Goals:**
- Isolating one floor, jumping to the ends, or any change to what the selector shows.

## Decisions

**Keys: Arrow Up and Arrow Down, matched on `e.code`.** They are the natural "up and down", and
laptop keyboards have no PageUp/PageDown key (it is Fn+Arrow). Nothing else in the viewer uses the
arrows outside walk mode: camera-controls is not given key events. Walk mode owns the arrows, so the
handler returns while `savedView` is set (the same flag the walk keydown handler uses) and floors
cannot be stepped from the keyboard while walking. `e.code` matches how the existing handlers read
keys. Alternatives: PageUp/PageDown (absent on laptops), `[` and `]` (work in walk mode too, but
hard to guess; easy to add later), `+`/`-` (read as zoom).

**Step from the highest storey shown.** `shownStoreys === null` means every storey. The current
floor is the highest shown storey in `storeysLowestFirst()` order; Up targets the next one, Down
targets the one below. This also defines a custom `?storeys=` set: it steps from its highest
storey and lands on a prefix. Down from a custom set whose highest storey is the lowest floor does
nothing, like any other bottom.

**No wrapping.** A missing neighbour is a no-op, not a clamp to the other end. Nothing is drawn or
written to the URL for it.

**Focus.** Ignore the key when the target is an `input`, `textarea` or `select` that is not the
storey selector. For the storey selector, `preventDefault()` and step ourselves: a select would
otherwise also move its own value, and in the opposite direction (its options run lowest first, so
Arrow Down would choose a higher floor); and since the selector keeps focus after a
mouse choice, the shortcut would be dead or doubled right after using the dropdown. Buttons are not
excluded; they take no arrow-key input.

**No runaway.** Ignore `e.repeat`, and guard with a module-level `stepping` flag held across
`await chooseStorey()` (cleared in `finally`), so a key press during an in-flight redraw is dropped
rather than queued. `chooseStorey()` awaits a fragments update, and a second concurrent call would
race on `shownStoreys`.

**Single storey, snapshot, walk mode, modifiers.** The selector is hidden for a single storey, so the handler
returns when the selector is hidden. Snapshot mode has no interactive UI, so it returns when
`snapshot` is set. Ctrl/Alt/Meta/Shift combinations belong to the browser and OS (Shift+Arrow
selects text), so they are left alone.

**Discoverability.** The selector's `title` becomes "Show every storey up to and including this one
(Up / Down arrows to step)". No new button, since the selector is the control.

## Risks / Trade-offs

- [Arrows also scroll a page, and move a focused select] → once the key is ours (past the walk,
  snapshot, modifier and form-control checks) the handler calls `preventDefault()` even at an end
  or on auto-repeat, so the storey selector can never move itself under the shortcut. The walk-mode
  handler does the same for the same keys.
- [A user expects Arrow Down to show the floor below by itself] → the selector's cumulative meaning
  is unchanged; the docs say the shortcut steps that selector.
- [Dropping a press during a redraw can feel unresponsive] → a redraw is one fragments update; a
  dropped press is preferable to a queue of floors flashing past.
