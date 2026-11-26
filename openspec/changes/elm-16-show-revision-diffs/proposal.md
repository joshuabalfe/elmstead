# Proposal

## Why

ELM-15 lets a model have revisions and lets the viewer switch between them from one viewpoint.
Flicking back and forth shows that something changed, but not what. You still have to spot a moved
wall or a new window by eye, and you can't see a demolished wall at all while the revision is shown.
For a proposal like a rear extension, the question is always the same: what is new, what changes,
what comes down. The model can answer that exactly, because elements keep their ids across
revisions.

## What Changes

- Compute a revision's diff against its base model, by element id: **added** (in the revision only),
  **removed** (in the base only) and **changed** (in both, but different). An opening also counts
  as changed when its component or its host wall changed, because either moves or reshapes it
  without touching its own JSON. Components are compared too. A revision has its base's storeys
  (ELM-15), so storeys are never added or removed.
- `build` on a revision also writes `out/<model>@<revision>.diff.json`, deterministic like the
  building JSON, and prints a one-line summary: `diff    elmstead@rear-extension: 7 added, 3 changed, 2 removed`.
- Add a Diff mode to the viewer, available while a revision is shown, toggled by a Diff button, the
  `D` key or `?diff=1`:
  - unchanged elements are drawn faded and partly see-through;
  - added elements are green, changed elements amber;
  - removed elements are shown as a red, see-through ghost taken from the base model's IFC, loaded
    alongside the revision.
- A changes panel in Diff mode gives the counts per category, with a checkbox to show or hide each.
  It also lists every change by storey; clicking one frames the camera on that element.
- Hovering in Diff mode adds the element's status to the hover label, e.g. `wall-ext-east · added`.
- Diff colours follow storey visibility, apply to the plan-style wall tops and room fills as well as
  the IFC geometry, and are kept when switching revisions.
- `render` on a revision also writes Diff-mode 3D snapshots, so a proposal's changes can be reviewed
  as PNGs in a pull request.

## Capabilities

### New Capabilities

- `model-diff`: how a revision is compared with its base, what counts as added, removed and
  changed, and the diff file and summary written by `build`.

### Modified Capabilities

- `ifc-viewer`: Diff mode, its colours, the removed-element ghosts, the changes panel, hover status
  and Diff snapshots.

## Impact

- **Depends on ELM-15:**
  - revisions as files or folders;
  - `<model>@<revision>` naming;
  - the same-storeys rule;
  - the shared `idNodes` walk in `src/schema/ids.ts`;
  - the base model the CLI already loads for a revision;
  - the revision picker;
  - the moved `models/examples/example-cottage` and its `rear-extension` revision.

  Implement after it merges.
- `src/diff/` (new): the pure diff function over two `BuildingModel`s, built on `idNodes`, and its
  JSON output.
- `src/cli/`: writing the diff file from the base ELM-15 already loads, the summary line, and Diff
  snapshots in `render`.
- `src/render/snapshot3d.ts`: the extra Diff views for a revision.
- `viewer/main.ts`, `viewer/index.html`: a second Fragments model for the base, item colouring,
  overlay colouring, the panel, the shortcut and hover status.
- `docs/rendering.md`: Diff mode and the diff file.
- No schema change. Nothing in the building JSON, IFC or plan SVGs changes.
- Out of scope:
  - **Plan drawings with demolition conventions** (existing grey, new hatched, demolished red
    dashed). This is a natural follow-up on the same diff file.
  - **Sub-element diffs**, such as showing which part of a lengthened wall is new.
  - **Diffing two revisions with each other.**
  - **Measurements that carry across a switch.**
