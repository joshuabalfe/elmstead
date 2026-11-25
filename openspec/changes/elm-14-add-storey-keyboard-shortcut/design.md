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

**Keys: PageUp and PageDown, matched on `e.code`.** Walk mode owns the arrows and W/A/S/D, and the
Page keys have no other meaning in the viewer, so they work in every mode, including walk. `e.code`
matches how the existing handlers read keys. Alternatives: `[` and `]` (hard to find on some
layouts), Up/Down arrows (clash with walk mode), `+`/`-` (read as zoom).

**Step from the highest storey shown.** `shownStoreys === null` means every storey. The current
floor is the highest shown storey in `storeysLowestFirst()` order; Up targets the next one, Down
targets the one below. This also defines a custom `?storeys=` set: it steps from its highest
storey and lands on a prefix. Down from a custom set whose highest storey is the lowest floor does
nothing, like any other bottom.

**No wrapping.** A missing neighbour is a no-op, not a clamp to the other end. Nothing is drawn or
written to the URL for it.

**Focus.** Ignore the key when the target is an `input`, `textarea` or `select` that is not the
storey selector. For the storey selector, `preventDefault()` and step ourselves: a select would
otherwise also move its own value on PageUp/PageDown, and since the selector keeps focus after a
mouse choice, the shortcut would be dead or doubled right after using the dropdown. Buttons are not
excluded; they take no PageUp/PageDown input.

**No runaway.** Ignore `e.repeat`, and guard with a module-level `stepping` flag held across
`await chooseStorey()` (cleared in `finally`), so a key press during an in-flight redraw is dropped
rather than queued. `chooseStorey()` awaits a fragments update, and a second concurrent call would
race on `shownStoreys`.

**Single storey, snapshot, modifiers.** The selector is hidden for a single storey, so the handler
returns when the selector is hidden. Snapshot mode has no interactive UI, so it returns when
`snapshot` is set. Ctrl/Alt/Meta/Shift combinations belong to the browser and OS (Shift+PageUp
selects text), so they are left alone.

**Discoverability.** The selector's `title` becomes "Show every storey up to and including this one
(PageUp / PageDown to step)". No new button, since the selector is the control.

## Risks / Trade-offs

- [PageUp/PageDown also scroll a page] → the viewer page does not scroll, and the handler calls
  `preventDefault()` only when it acts on the key.
- [A user expects PageDown to show the floor below by itself] → the selector's cumulative meaning
  is unchanged; the docs say the shortcut steps that selector.
- [Dropping a press during a redraw can feel unresponsive] → a redraw is one fragments update; a
  dropped press is preferable to a queue of floors flashing past.
