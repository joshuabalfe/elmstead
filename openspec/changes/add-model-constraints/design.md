# Design

## Context

- `loadModel` (`src/cli/load.ts`) imports a model module, round-trips its default export through
  JSON and parses it with the zod schema. The CLI then runs `checkModel` before `build`, `render`,
  `check` and `all` write anything (as hardened by `harden-mvp-pipeline`).
- Ids are unique across the whole model, so an id alone finds an element and its storey.
- Wall geometry already has what points need: `wallDirection`, `faceOffsets` and `wallPoint` in
  `src/geometry/wall.ts`. `face()` in `src/model/helpers.ts` gives compass faces of axis-aligned
  walls.
- Models are written by an LLM as often as by a person. The value of a constraint comes from it
  being written once, from a real measurement, and then left alone.

## Goals / Non-Goals

**Goals:**
- Points that follow the model when it moves, and fail loudly when what they name goes away.
- One check pass that reports every broken constraint, not just the first.
- No change to the building schema or anything downstream of it.

**Non-Goals:**
- Solving: the pipeline never moves anything to meet a constraint.
- Heights and 3D distances. Constraints are plan-only for now.
- Constraints on components that apply to every instance.
- Drawing constraints or their status on the plan.

## Decisions

### A separate file, found by convention
`constraints.ts` in a folder model, `<name>.constraints.ts` beside a single-file model. The CLI
looks for it next to the model path, so there is no flag to forget and no import from the model
into it or back. Alternatives:
- **A `constraints` field in the building schema.** Rejected: it grows the contract, lands in
  `building.json` and the JSON Schema, and puts measurements in the same files as the walls.
- **The model's `index.ts` re-exports constraints.** Rejected: it couples the model to the check,
  and a model could drop the export and silently lose its constraints.

### Its own small zod schema, loaded like a model
`src/constraints/schema.ts` defines the file's shape with `z.strictObject`, reusing `IdSchema`,
`MmSchema` and `NonNegativeMmSchema`. Loading evaluates the module, round-trips it through JSON and
parses it, exactly as `loadModel` does, so a typo is an error and what is checked is plain data.
This schema is not exported to `schema/building.schema.json`.

### Data shape
```ts
type Face = "left" | "right" | "north" | "south" | "east" | "west";
type Point =
  | { corner: [{ wall: Id; face: Face }, { wall: Id; face: Face }] }
  | { wall: Id; end: "start" | "end"; face?: Face }
  | { opening: Id; at: "start" | "end" | "centre"; face?: Face }
  | { room?: Id; corner: "north-east" | "north-west" | "south-east" | "south-west" | number };
interface Constraint {
  id: Id;
  note?: string;                       // where the measurement came from
  from: Point;
  to: Point;
  measure: "straight" | "x" | "y" | { along: Id };
  distance: Mm;                        // non-negative
  tolerance?: Mm;                      // non-negative, default 10
}
type Group = ({ storey: Id } | { room: Id }) & { constraints: Constraint[] };
```
Points are a union told apart by their keys (`corner` as a pair of faces or as a compass corner,
`wall`, `opening`). Small helpers in `src/constraints/index.ts` (`corner`, `wallEnd`, `jamb`,
`roomCorner`, `inStorey`, `inRoom`) build these values and take ids or model objects, so a
constraints file can import walls from the model's own modules and get type checking on them.

### Resolution
- **Faces.** `left` and `right` map straight to `faceOffsets`. A compass face is translated to
  `left` or `right` using the wall's direction. It is accepted only on walls running along plan x
  or y, and only for the two sides they have, matching `face()`.
- **Corner.** Each face is a line: the wall's start offset across by that face, in the wall's
  direction. The corner is where the two lines cross, using the same `cross` from
  `src/geometry/vec.ts`. Faces within 1e-9 of parallel do not meet.
- **Wall end and opening points.** `wallPoint(w, along, across)`, with `along` 0 or the wall length
  for an end, and `offsetAlongWall`, `offsetAlongWall + width` or their midpoint for an opening.
  `across` is 0 without a face or that face's offset.
- **Room corner.** For `south-west`, the vertex with the least `x + y`; similarly for the others. A
  tie within 1 mm is ambiguous. A number indexes the outline directly and is an error if out of
  range.

Points are not rounded: measured distances can be fractional on diagonal walls. Only the message
rounds.

### Checked beside `checkModel`, not inside it
`checkConstraints(model, groups)` returns `Issue[]`. The CLI calls it straight after `checkModel`
in each command and gates on both. `checkModel` keeps its single-argument signature, so the model
checks remain testable without constraints. A point that names something missing is reported and
that constraint is skipped, so other constraints are still checked.

Issue ids are constraint ids, and the message carries the scope:
`ERROR   living-corner-to-front-window (room-living): is 1800 mm, should be 1775 ±10 mm`. Using
the constraint id keeps one grep target per measurement. Constraint ids may repeat a model id: they
live in another file and never reach IFC.

### Absolute distances
Measures are unsigned. A sign would catch an opening that moves to the mirror position, but tape
readings have no direction and a sign convention per measure would be easy to get wrong. If mirror
moves turn out to matter, a second constraint to another point pins the position.

### Guarding the measurements
The pipeline cannot tell who edited a file, so the protection is a rule plus visibility:
- AGENTS.md says to change the model, not the constraint, when one fails, and to change a
  constraint only when the user gives a new measurement.
- Each constraint can carry a `note` saying where the number came from.
- The summary line shows that constraints ran, so silently losing the file is visible.

## Risks / Trade-offs

- [Constraints are edited alongside the model to make a failure go away] → AGENTS.md rule, `note`
  fields, and keeping constraints in their own file so the edit shows up separately in a diff.
- [Compass room corners pick an unexpected vertex on irregular rooms] → ties are errors, and a
  vertex number is available. Prefer wall-face corners for anything structural, because room
  outlines are themselves derived from walls.
- [Vertex numbers break when an outline gains a point] → the check fails loudly rather than
  measuring the wrong corner, and docs recommend compass corners or wall-face corners.
- [Unsigned distances miss mirror-image moves] → see "Absolute distances". Accepted for now.
- [A misplaced constraints file is silently ignored] → the summary line is printed only when a
  file is found, so a model that should have constraints visibly lacks the line. The Elmstead
  tests assert the line.

## Migration Plan

Additive. Models without a constraints file behave exactly as before. `harden-mvp-pipeline` should
be archived first, so `check`, `all` and the model-wide unique ids are part of the baseline specs.
