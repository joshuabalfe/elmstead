# Proposal

## Why

elmstead's ids name directions after the traced drawing, whose "north" is the top of the page.
The site's `northAngle` is 135°, so every compass word in an id is wrong by 135°. `wall-west` is
the front wall and faces roughly north-east. `wall-north` is the party wall and faces roughly
south-east. Anyone reading the model, or an IFC exported from it, is told the wrong thing about
the real building. The model also calls both side walls party walls, but the owner confirms
Elmstead is an end terrace. The side nearest the front door (plan north) is the party wall, and
the side with the wrap-around pavement (plan south) is an exposed end wall.

## What Changes

- **BREAKING (model ids):** rename every compass-worded id in `models/elmstead/` to building-relative
  words that don't depend on `northAngle`. That covers walls, rooms, doors, windows, slabs, railings
  and constraint ids. The external walls become `wall-front`, `wall-rear`, `wall-party` and
  `wall-end`. Elsewhere plan west becomes `front`, east becomes `rear`, north becomes `left` and
  south becomes `right`, as seen from the street. For example, `room-guest-north-basement` becomes
  `room-guest-left-basement`. design.md has the full table.
- Rename compass words in element `name`s (for example "First floor west") the same way.
- Reword comments and constraint `note`s to the same front/rear/left/right words, without changing
  any measurement. Where a comment describes plan geometry next to plan-axis code, it may keep plan
  axes but say so.
- Correct the prose that calls both side walls party walls. Plan north is the party wall and plan
  south is the exposed end wall, and both are gable ends.
- State the orientation once, in `models/elmstead/shared.ts` and `index.ts`: how plan axes map to
  front/rear/left/right, and that the front faces roughly north-east.
- Update `tests/elmstead.test.ts` to the new ids.

Unchanged: all geometry, every measurement and constraint distance, `northAngle`, and the src
API's plan-axis arguments (`face(wall, "north")`, `roomCorner("south-west")`, `face: "east"` in
constraints). Those arguments name plan axes by design and stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a model-only change. The pipeline's behaviour and the specs are unchanged, so the
change sets `skip_specs: true`.

## Impact

- `models/elmstead/**`: ids, names, comments and constraint notes. No geometry changes.
- `tests/elmstead.test.ts`: id references.
- IFC GlobalIds come from element ids (`src/ifc/guid.ts`), so every renamed element gets a new
  GlobalId. Anything holding an older elmstead IFC will see those elements as removed and re-added.
- elmstead has no revisions yet, so none need re-pointing.
- `out/` must be regenerated.
