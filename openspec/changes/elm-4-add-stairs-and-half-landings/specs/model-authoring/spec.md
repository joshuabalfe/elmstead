# Spec Delta

## ADDED Requirements

### Requirement: Stair helpers
`stairFlight(id, start, end, { width, risers })`, `stairLanding(id, outline, { thickness })` and
`stair(id, toStorey, segments)` SHALL build plain stair values. `stair` SHALL take the destination
`Storey` and record its id as `toStoreyId`. The helpers SHALL NOT compute elevations; the model
supplies plan geometry and riser counts only.

#### Scenario: Assembling a half-turn stair
- **WHEN** a model passes a lower flight, a half landing and an upper flight to `stair("stair-main", firstFloor, …)`
- **THEN** the stair's `toStoreyId` is `firstFloor.id` and its segments are in the given order

#### Scenario: Flight values
- **WHEN** `stairFlight("stair-flight-lower", start, end, { width: mm(825), risers: 8 })` is called
- **THEN** it returns a flight with those points, width and riser count

#### Scenario: Landing values
- **WHEN** `stairLanding("stair-landing-half", outline, { thickness: mm(150) })` is called
- **THEN** it returns a landing with that outline and thickness

### Requirement: Derived stair dimensions are plain numbers
Derived stair dimensions — the riser height, each flight's going and every segment's level — SHALL be
plain `number` millimetres, not the branded `Mm`. `Mm` is an integer brand, so `mm()` and `div()`
throw on a fraction and `divRound()` would round a 3050 / 16 riser to 191 mm, making sixteen risers
reach 3056 mm and miss the target storey. The IFC writer's `len` and `posLen` already take a plain
number, so nothing converts on the way out.

#### Scenario: Fractional riser height
- **WHEN** a stair geometry helper divides a 3050 mm rise into 16 risers
- **THEN** it returns 190.625 as a `number`, without passing it through `mm()`

#### Scenario: Division that must not round
- **WHEN** the helper divides a rise by a riser count
- **THEN** it uses plain division, because `div(mm(3050), 16)` throws and `divRound(mm(3050), 16)` gives 191