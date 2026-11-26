# Design

## Context

elmstead's plan has x east and y north, as `docs/modelling.md` requires of every model. "North" is
the top of the owner's drawing, which has no north arrow. `site.northAngle` is `deg(135)`, so true
north points towards the plan's south-west corner. Each plan side therefore faces a true
intercardinal direction:

| Plan side | Building side | Faces (true, approx.) | Construction |
|---|---|---|---|
| west (−x) | front, onto the street | north-east | 450 mm stone, front door and bay |
| east (+x) | rear, onto the garden | south-west | 350 mm stone, extension and garden doors |
| north (+y) | party wall, on the front-door side | south-east | 350 mm stone, continues across the extension |
| south (−y) | end wall, by the wrap-around pavement | north-west | 250 mm stone, exposed gable |

Seen from the street, facing the front wall, plan north is on the left and plan south is on the
right.

## Goals / Non-Goals

**Goals:**
- Every direction word in an elmstead id, name, note or comment is true of the real building.
- The words keep working if `northAngle` is refined, since 135° is described as "roughly".

**Non-Goals:**
- Changing src's plan-axis vocabulary (`face`, `faceSide`, `roomCorner`, `wallEnd` faces). Those
  name plan axes for every model, and changing them would be a pipeline change.
- Changing the example cottage, docs examples or any test fixture outside elmstead.
- Rotating the plan so +y is true north. That would make every wall diagonal and break the
  axis-aligned helpers the model relies on.

## Decisions

**Building-relative words, not true compass words.** At exactly 135°, every wall faces an
intercardinal direction, and the owner's figure is only approximate. Front/rear/party/end
describes the house without depending on that angle. Alternatives considered: true intercardinals
(`wall-north-east`) are correct but depend on the angle, and they are long. Nearest cardinal is
wrong by 45°.

**External walls get role names; everything else gets side words.** The four external runs become
`wall-front`, `wall-rear`, `wall-party` and `wall-end`. Inside ids, plan directions map as
west → `front`, east → `rear`, north → `left`, south → `right`, seen from the street. `party` and
`end` are kept for the walls that really are the party wall and the end wall, so that, for
example, `wall-bathroom-left` (an internal wall) can't be mistaken for the party wall.
`wall-north-extension` is the party wall continuing across the extension, so it becomes
`wall-party-extension`. The extension's own side wall, `wall-extension-south`, is not the end wall,
so it becomes `wall-extension-right`.

**Keep each id's existing order and suffixes.** Only the direction word changes, and the storey
suffixes (`-basement`, `-first`, `-attic`, `-main-half-landing`, `-attic-half-landing`) stay. That
keeps the diff mechanical and reviewable.

**Plan-axis arguments stay.** Code such as `face(wall("wall-front"), "east")` stays as it is. To
keep that readable, `shared.ts` gets one header paragraph that maps plan axes to building sides and
true directions, and `index.ts`'s orientation note points to it.

**Notes keep their measurements.** Constraint `note`s from the owner are reworded only where they
use a plan compass word, for example "west to east" becomes "front to back". Every number and
attribution stays. This does not change a constraint, so the AGENTS.md rule on constraints still
holds.

### Rename table

| Old id | New id |
|---|---|
| `wall-west`, `wall-west-basement`, `wall-west-attic` | `wall-front`, `wall-front-basement`, `wall-front-attic` |
| `wall-west-first-north`, `wall-west-first-south` | `wall-front-first-left`, `wall-front-first-right` |
| `wall-east`, `wall-east-basement`, `wall-east-first` | `wall-rear`, `wall-rear-basement`, `wall-rear-first` |
| `wall-north`, `wall-north-basement`, `wall-north-first`, `wall-north-attic` | `wall-party`, `wall-party-basement`, `wall-party-first`, `wall-party-attic` |
| `wall-south`, `wall-south-basement`, `wall-south-first`, `wall-south-attic` | `wall-end`, `wall-end-basement`, `wall-end-first`, `wall-end-attic` |
| `wall-north-extension` (+ `-main-half-landing`, `-attic-half-landing`) | `wall-party-extension` (+ same suffixes) |
| `wall-extension-east` (+ `-basement`, `-main-half-landing`, `-attic-half-landing`) | `wall-extension-rear` (+ same suffixes) |
| `wall-extension-south` (+ `-basement`, `-main-half-landing`, `-attic-half-landing`) | `wall-extension-right` (+ same suffixes) |
| `wall-bathroom-north` | `wall-bathroom-left` |
| `wall-bay-north-first`, `wall-bay-south-first` | `wall-bay-left-first`, `wall-bay-right-first` |
| `window-bay-north-first`, `window-bay-south-first` | `window-bay-left-first`, `window-bay-right-first` |
| `wall-bedroom-north-first` | `wall-bedroom-left-first` |
| `wall-breast-south-basement` | `wall-breast-right-basement` |
| `wall-dining-north-first` | `wall-dining-left-first` |
| `wall-ensuite-north-first`, `-south-first`, `-west-first` | `wall-ensuite-left-first`, `-right-first`, `-front-first` |
| `wall-hall-south-basement` | `wall-hall-right-basement` |
| `wall-kitchen-east-first`, `wall-kitchen-east-lower-first` | `wall-kitchen-rear-first`, `wall-kitchen-rear-lower-first` |
| `wall-north-bed-east-basement` | `wall-left-bed-rear-basement` |
| `wall-shower-north-basement`, `wall-shower-west-basement` | `wall-shower-left-basement`, `wall-shower-front-basement` |
| `room-guest-north-basement`, `room-guest-south-basement` | `room-guest-left-basement`, `room-guest-right-basement` |
| `door-guest-north-basement`, `door-guest-south-basement` | `door-guest-left-basement`, `door-guest-right-basement` |
| `window-guest-north-basement`, `window-guest-south-basement` | `window-guest-left-basement`, `window-guest-right-basement` |
| `door-garden-north-basement`, `door-garden-south-basement` | `door-garden-left-basement`, `door-garden-right-basement` |
| `window-kitchen-west-first` | `window-kitchen-front-first` |
| `railing-front-north`, `railing-front-south`, `railing-front-facade-south` | `railing-front-left`, `railing-front-right`, `railing-front-facade-right` |
| `slab-first-west`, `slab-first-south`, `slab-first-north-band` | `slab-first-front`, `slab-first-right`, `slab-first-left-band` |
| constraint `alcove-west`, `alcove-east` | `alcove-front`, `alcove-rear` |
| constraint `guest-north-width-basement`, `guest-north-depth-basement` | `guest-left-width-basement`, `guest-left-depth-basement` |
| constraint `guest-south-window-width-basement` | `guest-right-window-width-basement` |
| constraint `stair-flight-width-south` | `stair-flight-width-right` |

TypeScript identifiers follow their ids (for example `northBedEast` → `leftBedRear`,
`externalRuns.north` → `externalRuns.party`), so names in code and in output agree.

## Risks / Trade-offs

- [A missed compass word leaves a wrong direction] → After renaming, grep `models/elmstead` and
  `tests/elmstead.test.ts` for `north|south|east|west`. Every remaining hit must be a plan-axis
  argument, the `northAngle` line, or the orientation note.
- [A renamed id breaks a constraint or test reference] → `npm run check` resolves every constraint
  id, and `npm test` covers the rest. Constraints must still all be met with unchanged distances.
- [GlobalIds change for renamed elements] → Accepted. Ids are the GUID keys by design, and there
  are no downstream IFC consumers to migrate.
- [left/right depends on the viewpoint] → It is defined once, as seen from the street, in
  `shared.ts`. The external walls use role names, which don't depend on a viewpoint.
