# Design

## Context

The element kinds are enumerated independently in:

| Place                                           | What it enumerates                                            | Failure if a kind is missed            |
| ----------------------------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| `shared/schema/ids.ts` `idNodes`                | each storey collection, openings' door/window, stair segments | ids, constraints, GlobalIds miss it    |
| `backend/model/revise.ts` `SCHEMAS`             | collection → zod schema                                       | a revision cannot add/replace it       |
| `shared/diff/index.ts` `COMPARED` + `signature` | compared kinds; storey arrays to strip                        | **silent**: it never appears in a diff |
| `frontend/scene/engine.ts` `storeyItemsOf`      | id → storey owner map                                         | storey visibility misses it            |
| `backend/checks/model.ts` `outlined`            | outline-bearing kinds                                         | outline checks miss it                 |

`STOREY_COLLECTIONS` already exists as a const, but only its _type_ is used; the runtime walks are
hand-written. The viewer even imports `idNodes` (for `storeyIndex`) 200 lines below the owner map
that duplicates it.

## Goals / Non-Goals

**Goals**

- One table drives the id walk, revision schemas, diff comparison and the viewer owner map.
- A new storey collection without a table entry fails typecheck.
- Byte-identical JSON, IFC, diff and plan outputs; the whole suite green without assertion changes.

**Non-Goals**

- No schema change, no new element type.
- Geometry enumerations stay explicit: `shownBox`, `storeyTop`, `makeView`, `outlined`, and the
  three renderings (writer, plan, viewer presentation). Geometry differs per kind; it is not
  plumbing, and forcing it into the table would invent a generic geometry interface the repo does
  not need.
- No plugin/registry framework. A plain const table with derived maps.

## Decisions

### D1: Table shape

`src/shared/schema/kinds.ts`:

```ts
export const STOREY_KINDS = {
  walls: { schema: WallSchema, kind: () => "wall" },
  openings: { schema: OpeningSchema, kind: (o) => o.kind }, // "door" | "window"
  slabs: { schema: SlabSchema, kind: () => "slab" },
  rooms: { schema: RoomSchema, kind: () => "room" },
  stairs: { schema: StairSchema, kind: () => "stair", children: stairSegments },
  railings: { schema: RailingSchema, kind: () => "railing" },
} satisfies Record<StoreyArrayKey, KindEntry>;
```

`StoreyArrayKey` is derived from the `Storey` type (every array-valued optional-or-required field),
so the `satisfies` clause is the completeness constraint: a new storey array without an entry is a
type error. `STOREY_COLLECTIONS` and `StoreyCollection` derive from `Object.keys(STOREY_KINDS)`
(object key order is insertion order, which matches today's walk order). Components keep their two
collections in the same table file. `children` handles the one nested case (stair flights/landings,
which carry a storey but no place); openings' discrimination is the `kind` function.

### D2: Derivations

- `idNodes`: project/site/building and the storey node stay explicit; the per-collection walk becomes
  a loop over the table, calling `kind`/`children`. Node order is unchanged (walls, openings, slabs,
  rooms, stairs+segments, railings; components last).
- `revise.ts` `SCHEMAS`: built from the table (storey + component entries).
- `diff`: the `COMPARED` list disappears; the diff compares every node the id walk places, plus
  storeys. `signature` strips the table's storey collections generically (`Object.fromEntries` over
  the keys) instead of naming them.
- `engine.ts` `storeyItemsOf`: the owner map becomes `storeyIndex(modelJson)` (already in the file),
  deleting the hand-enumerated loops.

### D3: What the type error does and does not catch

The `satisfies Record<StoreyArrayKey, …>` catches a _new collection_ at compile time. It cannot
catch a new _kind inside_ an existing discriminated collection (e.g. a third opening kind) — the
`kind` function's return type must stay assignable to `IdNode["kind"]`, which the `IdNode` union
still constrains; adding a kind there remains a deliberate union edit, as today.

### D4: Order is a contract

Diff output order, `idNodes` order and the JSON round-trip all depend on walk order. The table's
insertion order equals today's `STOREY_COLLECTIONS` order, and the acceptance check compares
outputs byte-for-byte rather than trusting the argument.

## Risks / Trade-offs

- **Over-abstraction** — mitigated by keeping geometry and the renderings out; the table is ~40 lines
  and replaces ~60 lines of enumeration.
- **Generic typing friction** (`satisfies` + inferred key types under `exactOptionalPropertyTypes`)
  — the implementation may need a small helper type; the contract (D1) stays the same.
- **Residual coupling with ELM-25**: the owner-map deletion lands in engine code ELM-25 will move;
  whichever lands second re-cuts it. No shared spec blocks with ELM-23/26.

## Acceptance / Migration

1. Build every model and revision before and after; JSON, IFC, diff and plan SVG byte-identical.
2. `npm test` green with no assertion changes (ids, revise, diff, checks, viewer suites).
3. A new structural test: the table covers every storey array key (runtime mirror of the type
   constraint) and `idNodes` order matches a frozen fixture order.
4. docs/development.md's checklist collapses the plumbing steps (schema, ids, revisions, diff) into
   "add the table entry"; the rendering steps remain.
