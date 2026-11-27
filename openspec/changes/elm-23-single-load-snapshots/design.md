# Design

## Context

`snapshot3d` (src/backend/render/snapshot3d.ts) starts one Vite server and one Chromium page, then
for each variant × view does:

```
page.goto(?model=<name>&view=<view>&snapshot=1[&diff=1])
waitForFunction(__elmsteadReady || __elmsteadError)
page.screenshot()
```

Every `goto` is a full viewer startup: fetch `/models.json`, the IFC, the building JSON and the
constraints JSON; initialise web-ifc's WASM; convert the IFC to Fragments in the worker; build the
label, plan and constraint layers; apply style and dressing; fit the camera. The IFC conversion and
WASM init dominate, and they are identical work repeated five times (base) or ten (revision). The
viewer already switches views without reloading — `chooseView` → `setView` is the same code path
`load()` uses for the initial `?view=` — so the repetition is unnecessary.

## Goals / Non-Goals

**Goals**

- One page load per snapshot variant; later cameras drawn in the same page.
- Byte-identical PNGs: same cameras, framing, colours and files as today.
- A measurable render-time win, reported with before/after numbers.

**Non-Goals**

- One load for _both_ variants (toggling Diff in-page). It would save one more load but couple
  snapshots to the toggle/crossfade path and the `?diff=1` URL contract; two loads already remove
  80–90% of the repeated work. Revisit only if measurements justify it.
- Changing the plan-versus-3D tests' `viewOf` helper — it intentionally loads fresh pages.
- Touching the watch/reload path (ELM-22): snapshots neither watch `out/` nor call `reloadModel`.

## Decisions

### D1: The driver loads once per variant, then cycles views

```
for variant of variants:
  page.goto(?model&snapshot=1&view=<first>&<variant.query>)
  wait __elmsteadReady / __elmsteadError        # first camera already framed by load()
  capture first view
  for view of rest:
    page.evaluate(__elmsteadChooseView(view))
    wait __elmsteadViews > n                     # applied and drawn
    capture
```

`VIEWS` order (sw, se, ne, nw, top) is unchanged; the first view rides the URL so the existing
`__elmsteadReady` contract covers it. The Diff variant keeps `&diff=1` in its URL, so
`refreshDiff`/`dressGhosts` run during load exactly as today — no in-page toggling.

### D2: A snapshot-only window handle for view switching

`ViewerApi` lives in React, not on `window`. In snapshot mode only, `createViewer` exposes
`window.__elmsteadChooseView = (view) => api.chooseView(view)` (typed in the existing `declare
global` block). Interactive mode is unchanged. This follows the repo's existing window-hook pattern
(`__elmsteadReady`, `__elmsteadStoreyChanges`, …) rather than inventing a second IPC channel.

### D3: A dedicated settled-view counter, not a reused one

`chooseView` increments `window.__elmsteadViews` after `setView` resolves and two animation frames
have drawn — the same pattern as `applyStoreyChoice`'s `__elmsteadStoreyChanges`. Reusing
`__elmsteadViewChanges` was rejected: its documented meaning is a Diff/Transparency/panel choice
applied through `applyViewChange`, and widening it would muddy the existing viewer tests that wait
on it. `chooseView` in snapshot mode never walks (`exitWalk` is a no-op without a saved view), so
the path is just `setView` + the counter.

### D4: Why the pixels stay identical

`setView` fully determines the camera: projection set, `setLookAt(…, false)`, `fitToSphere(…,
false)` — all instant, no easing state carried between views. Snapshot framing (plan box, snapshot
fit factors, turned-top widening) is computed from the model and the viewport, both unchanged
between views. The model is dressed once at load; `chooseView` does not redress. The acceptance
check (below) proves identity rather than arguing it.

### D5: Failure paths unchanged

`pageerror` collection, the `__elmsteadError` check, and the `finally` that closes browser and
server stay as they are. A failed view switch surfaces as a page error or a timeout waiting for
`__elmsteadViews`, throwing out of the loop into the same cleanup. Missing Chromium remains a
WARNING upstream in `render3d`.

### D6: An observable load count

The driver prints one line per variant, in the repo's log style:
`snap    <name>: 5 views, 1 page load` (Diff: `5 diff views, 1 page load`). The CLI tests assert
it, which is how the "one page load per variant" scenario is verified from outside the browser.

## Risks / Trade-offs

- **Camera state leak between views** — mitigated by D4's instant, fully-determining camera calls
  and proven by byte-identical PNGs; if any view differs, the acceptance check names the file.
- **A view switch racing load** — the driver waits for `__elmsteadReady` before the first switch;
  `chooseView` awaits `setView`, and the counter only increments after two drawn frames.
- **Residual coupling with ELM-25** (engine decomposition moves `chooseView`/`setView`): whichever
  lands second re-cuts the hook placement; both keep the window contract, so the re-cut is mechanical.
- **One more window hook** — accepted; it is snapshot-only and joins the existing test surface.

## Acceptance / Migration

1. Record before PNGs: build and render `models/examples/example-cottage`, its `rear-extension`
   revision, and `models/elmstead` on main; keep the PNG hashes and wall-clock times.
2. Implement; re-render the same models; every PNG byte-identical (sha256 comparison).
3. Report the render-time delta (same machine, same models), per the repo's measured-deltas rule.
4. No migration: outputs keep their names and bytes; only the production mechanism and one log line
   change.
