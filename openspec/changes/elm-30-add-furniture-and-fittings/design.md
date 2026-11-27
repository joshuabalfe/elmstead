# Design

## Context

See proposal.md - Why. The pipeline is storey-based: elements live in a storey's arrays, plans are
drawn from the model, and IFC is written by `src/backend/ifc/writer.ts` from the JSON contract. Three
precedents shape this change. Railings (ELM-12) are an optional storey array whose shape is derived by
one geometry module (`src/shared/geometry/railing.ts`) shared by the writer, the round-trip and the
plan, and exported as several extruded rectangles in one body. The element-kind table (ELM-24,
`src/shared/schema/kinds.ts`) is the one place a storey collection is enumerated: the id walk,
revisions, the diff and the viewer's storey ownership all read it, so this change adds an entry rather
than a hand-edit to each. Door and window components write one IFC type
per design and relate the instances with `IfcRelDefinesByType`, keeping the design apart from each
opening's size.

IFC4 classifies furnishings, but does not say what they look like: it has `IfcFurniture`,
`IfcSanitaryTerminal` and predefined type enums, and no standard catalogue of shapes. In IFC4
`IfcFurniture` has no predefined type of its own, so a furniture type carries the classification
(`IfcFurnitureTypeEnum`: `BED`, `CHAIR`, `DESK`, `FILECABINET`, `SHELF`, `SOFA`, `TABLE`), while
`IfcSanitaryTerminalTypeEnum` has `BATH`, `SHOWER`, `SINK`, `TOILETPAN`, `WASHHANDBASIN` and others.
The pinned web-ifc 0.0.80 exposes all of these classes and enums. Presentation is type-keyed:
`STYLES` in `src/shared/ifc/styles.ts` is what the viewer recognises, and the plan palette `C` in
`src/shared/render/style.ts` is what the plan-versus-3D comparison classifies.

The Bonsai furniture library (`IFC4 Furniture Library.ifc` and its generator script in IfcOpenShell,
GPL-3.0-or-later for the script) was read to see what is practical: its items are swept solids
over closed profiles, each with a 2D plan curve, and every type has `PredefinedType` `NOTDEFINED`.
It informs this design only; none of its data or code is used.

## Goals / Non-Goals

**Goals:**

- Let a model say what is in a room, and have the plan, the 3D view and the IFC show a recognisable
  object of the right IFC class, not a box.
- Cover every `IfcFurnitureTypeEnum` value and the household `IfcSanitaryTerminalTypeEnum` values
  with the right predefined type, so other IFC tools classify them correctly.
- Reuse the railing philosophy: author a position and a size, derive the shape in one geometry
  module shared by every consumer.
- Keep every model without furnishings byte-identical in JSON, IFC and snapshots.

**Non-Goals:**

- Kitchen units, wardrobes (a `USERDEFINED` furniture type) and electric appliances.
- Round, curved or sloped shapes, upholstery detail, drawers, taps and other small parts.
- Imported or mesh assets, a component library, finishes and materials.
- Wall-relative placement helpers and any clearance, reach or ergonomic checking.
- Furnishings that are mounted in or cut into walls.

## Decisions

**One `Furnishing` element with a closed `kind`, in an optional `furnishings` array.** A furnishing
stores an id, an optional name, `kind`, `at` (the footprint centre), and optional `rotation`,
`elevationOffset`, `width`, `depth` and `height`. An omitted size is the kind's default, so a model
need only say `sofa` and where. The twelve kinds are the IFC4 predefined type values themselves in
kebab-case, so the schema names what IFC names and a reader can map one to the other: `bed`, `chair`,
`desk`, `file-cabinet`, `shelf`, `sofa`, `table`, `bath`, `shower`, `sink`, `toilet` (`TOILETPAN`) and
`wash-basin` (`WASHHANDBASIN`). The collection is optional like `stairs` and `railings`, so existing
JSON, IFC and snapshots do not change. One element covers furniture and fittings because they share
placement, size and derivation; the IFC class is a function of the kind. This is why no existing type
works: see the proposal.

Alternatives rejected: a free-form element with an IFC class and parts supplied by the model (a bigger
schema, no recognisable defaults, and it invites each model to reinvent a chair); separate
`furniture` and `fittings` arrays (two shapes for one idea); importing the Bonsai library file or a
mesh asset (it bypasses the writer and its volume checks, its types are `NOTDEFINED`, and the licence
question is not ours to take on); keeping boxes (they do not tell a bed from a table on a plan).

**Kinds live in the schema; shapes live in geometry.** `FURNISHING_KINDS` is a constant in
`src/shared/schema/schema.ts` so zod validates the kind and the JSON Schema lists it.
`src/shared/geometry/furnishing.ts` holds a table keyed by kind (typed `Record<FurnishingKind, ...>`, so a new kind that lacks a shape
fails type-checking) with the kind's default size and a function from an overall size to parts. This
keeps the existing dependency direction: schema depends on nothing, geometry depends on schema types.
The IFC class and predefined type per kind live with the writer.

**Parts are additive, non-overlapping, axis-aligned boxes, in the furnishing's local frame.** Each
part is a box with a position and size inside the overall `width × depth × height`, local x being
width and local y depth. Together they touch every face of that box, so the overall size is the real
extent. Parts never overlap, so the IFC mesh volume is the sum of the part volumes (the frame and
bars precedent) and the round-trip needs no boolean arithmetic. Hollow fittings are built from a
base and a rim of four walls, not by subtracting a void. Part thicknesses are `min(fixed value,
fraction of the dimension)`, so any positive size gives valid parts. Rotation applies to the whole
furnishing through its placement; the parts stay axis-aligned in the local frame, so volumes do not
depend on rotation.

| Kind           | Default w × d × h (mm, provisional) | Parts                                                  |
| -------------- | ----------------------------------- | ------------------------------------------------------ |
| `bed`          | 1400 × 2000 × 900                   | frame, mattress on it, headboard across the back       |
| `chair`        | 450 × 450 × 900                     | four legs, seat on them, back panel behind the seat    |
| `desk`         | 1400 × 700 × 750                    | top, two side panels                                   |
| `file-cabinet` | 450 × 600 × 1300                    | one body                                               |
| `shelf`        | 800 × 300 × 1800                    | two sides, top, bottom, three inner shelves; open back |
| `sofa`         | 2000 × 900 × 850                    | two arms, seat block between them, back between them   |
| `table`        | 1500 × 800 × 750                    | top, four legs                                         |
| `bath`         | 1700 × 700 × 550                    | base, four rim walls around the recess                 |
| `shower`       | 900 × 900 × 150                     | tray base, four rim walls (tray only, no screen)       |
| `sink`         | 1200 × 600 × 900                    | cabinet, four rim walls around the basin recess        |
| `toilet`       | 400 × 700 × 800                     | pan at the front, cistern across the back              |
| `wash-basin`   | 550 × 450 × 850                     | pedestal, basin base, four rim walls                   |

The default sizes are typical household dimensions chosen for this repo, not measurements of any
building; a model that needs a particular size overrides it. They are provisional and can change by
eye without changing the specs.

**Placement.** `at` is the footprint centre because rotation is then about the item's own middle,
and the common authoring task is "put a table in the middle of this room". Directions are in plan
coordinates, the ones walls and rooms use (plan +y is the model's "north", whatever the site's
`northAngle`). At rotation 0 width is along plan x, the front faces plan -y and the back plan +y, and a
positive `rotation` is counter-clockwise seen from above, so a bed's headboard (back) faces plan +y by
default and plan -x at 90. The sheet's north-up turn (ELM-19) applies to the whole drawing, so symbols
are placed with the view's `toPx` like every other element and need no orientation logic of their own.
The base sits at storey elevation plus `elevationOffset` (default 0) for raised items such as a wall
shelf.

**IFC mapping.** Each furnishing is one `IfcFurniture` or `IfcSanitaryTerminal` contained in its
storey, `Tag` = id, `Name` = name or id, placed with the writer's existing placement helper using
the rotation as the placement's x direction. Its `Body` is a `SweptSolid` of one extruded rectangle
per part, styled with the furniture or sanitary colour. It also carries a `FootPrint` / `Curve2D`
representation of the overall outline in the existing footprint context, which is IFC's standard
place for a plan symbol. A type is written once per kind used (`IfcFurnitureType` or
`IfcSanitaryTerminalType`), with the kind's predefined type, declared by the project and related to
its instances by `IfcRelDefinesByType`; GlobalIds derive from the kind so the output stays
deterministic. Types hold no geometry because size varies per instance, as door and window types
do. Because the kinds are derived, nothing about them is authored in the JSON: there is no
`components` entry for furnishings. A furnishing component (a design with finishes) can be added when
there is a design property to put in it.

**Plan symbol from the parts.** The plan draws the outline of each part's footprint, rotated with the
furnishing, and skips a part whose footprint lies wholly inside a higher part's. That gives what is
seen from above (a table is its top, not its legs; a chair is a seat and a back; a bath shows its
rim and recess) from the same geometry as the 3D body, so the two cannot disagree and no separate
symbol table is needed. The `furnishing` group carries the id, is drawn after walls and openings and
before railings and stairs, and uses the same two colours as the IFC (set as plan palette entries, as
`C.railing` mirrors `STYLES.railing`). `makeView` gains a furnishings option, as it has one for railings, so footprints extend the plan
sheet's extent only; the shared overlay renderers keep their extent and draw no furnishings, so the viewer's
plan overlay is unchanged.

**Two colour contracts, two colours.** `STYLES.furniture` and `STYLES.sanitary` must each be at
least 0.02 RGB from every other entry so `styleOf` recognises them, and each plan colour must
classify as neither wall, room nor paper (±5 per channel) so the comparison skips furnishing pixels,
as it does stairs and railings. Provisional values: furniture warm timber (0.76, 0.62, 0.42) and
sanitary pale blue-grey (0.82, 0.88, 0.92). Two colours let a viewer tell a sofa from a bath at a
glance.

**Viewer: recognition, bounds and nothing else.** Adding the two entries to `STYLES` makes `styleOf`
recognise them; they keep their IFC colour in plan style and 3D, like railings, with no top patch.
Storey visibility needs no edit: the owner map is derived from the element-kind table, so the table
entry is what hides a furnishing with its storey. The viewer's `shownBox` gains furnishing points, and
`storeyTop` the height of a furnishing, which matters for a storey with no walls. Hover labels and
the Diff ghosts need no change: both read every item's `Tag`, and a furnishing's parts share one
element.

**Plumbing from the table.** A `furnishings` entry in `STOREY_KINDS` (schema `FurnishingSchema`, kind
`"furnishing"`) and a `furnishing` member of the `IdNode` union give the unique-id walk, `revise`'s
`addTo`/`replace`/`remove`, the diff and the viewer's storey ownership. A storey array without an entry
fails typecheck, so nothing else enumerates it. The diff then lists furnishings with no code, which
is a behaviour worth specifying and testing because the diff failing silently was the reason for the
table.

**Checks.** Add one new check, on top of the unique-id walk the table provides: a furnishing's rotated footprint must
not overlap a wall's body in plan on its storey. Touching is allowed so a basin can stand against a
wall. It reuses the wall and polygon geometry, tests whether the interiors overlap, and reports an
ERROR against the furnishing naming the wall. Furnishing-to-furnishing overlap is deliberately not
checked: chairs tuck under tables and a lamp stands on a desk. Sizes need no check beyond the
schema because the parts scale.

**Plan-versus-3D: exempt, by colour.** Furnishings are neither compared nor excluded by a storey
rule: both plan colours classify as neither wall, room nor paper, so `isIgnoredColour` skips them as
it does stairs and railings, and the fixture furnishings keep clear of walls so they cannot hide wall
pixels. `comparable` is unchanged because a furnishing makes no storey pitched or narrow.

**Constraints.** Constraints point at walls, so nothing is added there; a constraint that names a
furnishing id gets the existing "is a furnishing, not a wall" error, which a test confirms.

**Model: a furnished revision of the cottage.** `models/examples/example-cottage/revisions/furnished.ts`
adds furnishings through `revise(base, [addTo(...)])`, positions derived from the base's wall faces
and room outlines with the existing helpers (so they follow if a wall thickens), exercising each of
the twelve kinds at least once. The base cottage, the elmstead model and their snapshots do not
change, and no constraints are added: positions are not measurements.

## Treatment sheet

The repo's add-support-for-new-element-types skill asks for each view's decision up front.

| View            | Decision                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shape           | `Furnishing`: `id`, `name?`, `kind`, `at`, `rotation?`, `elevationOffset?`, `width?`, `depth?`, `height?`, in a storey's optional `furnishings`; no parts with ids of their own                                                      |
| IFC             | `IfcFurniture` (type `IfcFurnitureType`) or `IfcSanitaryTerminal` (type `IfcSanitaryTerminalType`), contained in the storey; a `SweptSolid` body of extruded rectangles; a `FootPrint` curve; the round-trip checks the part volumes |
| Plan            | Symbolic outlines of the visible part footprints; drawn after walls and openings, before railings and stairs; `class="furnishing"`, `data-id`; widens the sheet's extent only                                                        |
| Viewer          | Keeps its IFC colour in 3D and plan style (no recolour); hides with its storey through the table; enlarges `shownBox` and `storeyTop`                                                                                                |
| Checks          | Unique id (table); no overlap with a wall body on its storey                                                                                                                                                                         |
| Colours         | `STYLES.furniture` and `STYLES.sanitary`, and matching `C` entries, each 0.02 or more from every other IFC colour and clear of wall, room and paper                                                                                  |
| Revisions, diff | A revision adds, replaces and removes furnishings by id; the diff lists them, both from the table                                                                                                                                    |
| Plan-versus-3D  | Exempt by colour, as railings are; the reason is above                                                                                                                                                                               |

## Risks / Trade-offs

- [IFC4's `IfcFurniture` has no predefined type, so classification depends on the type] → the type is
  always written and related; IfcOpenShell validation of a model with every kind is a task, and the
  type's `PredefinedType` is asserted in the IFC tests.
- [IfcOpenShell may reject a `FootPrint` representation or its context] → build the full model
  through the validator early; if it objects, drop the footprint representation (the body, types and
  plan are unaffected) and amend the `ifc-export` spec.
- [Fragments may merge or drop several solids per element] → railings already rely on a multi-solid
  body; eye-check each kind in the viewer early.
- [A furnished house multiplies solids: about 6 per chair, about 300 for forty items] → measure with
  the existing viewer benchmark script on the furnished cottage; parts are plain boxes, so the cost
  is expected to be small.
- [Stylised shapes are still not a real chair] → accepted; they are recognisable on a plan and in 3D,
  and a richer shape is a change to one generator, not the schema.
- [Default sizes are unmeasured] → documented as provisional and overridable per furnishing; changing
  a default changes derived output, not the contract.
- [A closed catalogue needs a schema change for each new kind] → intended: new kinds (wardrobe,
  appliances) are deliberate, each a schema export regeneration and one generator.
- [The wall-overlap check can reject an item deliberately built into a wall] → touching is allowed,
  and built-in items are a non-goal; a model can leave a small gap.
- [Plan outlines for small items may clutter at low scale] → outlines are thin and only the visible
  parts are drawn; judged by eye on the cottage plan.

## Migration Plan

Additive optional array, two new style entries and a new capability. No model must change; existing
models omit `furnishings` and produce byte-identical output. Rollback removes the array, the schema
entries, the geometry module and the style entries; a model that used furnishings would fail
validation and must drop them with the field.

## Open Questions

- The default sizes, the two colours and the part thicknesses are settled as provisional choices that
  can change by eye without changing the specs.
- Whether `wardrobe` should join the catalogue as a `USERDEFINED` furniture type with an element
  type, and whether electric appliances (cooker, fridge, dishwasher) come next, are follow-up changes.
- Whether a wall-relative placement helper (for example "against this wall face, centred on this
  point") is worth adding once a few rooms have been furnished by hand.
