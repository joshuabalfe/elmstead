# Proposal

## Why

Adding one element type is a 20-step checklist across ~15 files (docs/development.md). Some of that
is irreducible — the IFC, plan and viewer are three deliberately separate renderings — but the
_model plumbing_ is hand-enumerated in several places that must agree: `idNodes` walks the storey
collections explicitly, `revise.ts` keeps its own collection→schema map, the diff keeps a `COMPARED`
set _and_ a hand-destructured storey signature, and the viewer's `storeyItemsOf` rebuilds an
id→storey owner map that `idNodes` already produces. A kind missing from the diff's lists never
shows up in a revision's diff — a silent failure the docs themselves warn about. The repo is
growing fast (20 changes archived in the last week); this is the structural cost that grows with
every new element type.

## What Changes

- One **element-kind table** beside the schema (`src/shared/schema/kinds.ts`): each storey
  collection maps to its zod schema, the kinds it yields, and how its elements expand into id nodes
  (openings discriminate door/window; stairs nest their segments). Component collections join it.
- `STOREY_COLLECTIONS`/`StoreyCollection` derive from the table; a storey array added to the schema
  without a table entry is a **type error**, not a silent omission.
- `idNodes`, the revision `SCHEMAS` map and the diff's compared nodes and storey signature derive
  from the table; the diff's separate `COMPARED` list disappears. Node order is preserved exactly,
  so JSON, IFC and diff outputs stay byte-identical.
- The viewer's `storeyItemsOf` owner map reuses the id walk (`storeyIndex`) instead of re-enumerating
  collections.
- The "add an element type" checklist shrinks: the plumbing steps collapse into one table entry.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `building-schema`: a new _Element kind table_ requirement — the id walk, revision validation and
  the diff take their collections and kinds from one table, and an untabled storey collection fails
  typecheck.
- `model-diff`: _Elements are matched by id_ — the compared kinds are derived from the id walk via
  the table, not a separate enumerated list.

## Impact

- `src/shared/schema/` (new `kinds.ts`, `ids.ts`), `src/backend/model/revise.ts`,
  `src/shared/diff/index.ts`, `src/frontend/scene/engine.ts` (owner map only).
- `tests/ids.test.ts`, `tests/revise.test.ts`, `tests/diff.test.ts` — unchanged assertions hold; a
  new structural test covers the table's completeness.
- `docs/development.md` (the checklist), `docs/architecture.md` (module layout).
- No schema change, no new dependencies, no output change. What stays explicit: geometry
  enumerations (`shownBox`, `storeyTop`, `makeView`, `outlined`) and the three renderings — geometry
  differs per kind and is not plumbing.
- Residual coupling: ELM-25 (engine decomposition) will move the owner-map code; whichever lands
  second re-cuts it. Independent of ELM-23 and ELM-26.
