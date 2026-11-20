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