# Spec Delta

## ADDED Requirements

### Requirement: Winder helper

`stairWinder(id, outline, { pivot, entry, risers })` SHALL build a plain winder segment for `stair()`,
recording the outline, pivot, entry and risers as given and checking none of them.

#### Scenario: Assembling a winding stair

- **WHEN** a model passes a winder and a flight to `stair("stair-main", firstFloor, …)`
- **THEN** the stair's `toStoreyId` is `firstFloor.id` and its segments are the winder then the flight

#### Scenario: Winder values as given

- **WHEN** `stairWinder("stair-winder-turn", outline, { pivot, entry, risers: 3 })` is called
- **THEN** the result has `kind: "winder"`, that id, that outline, that pivot, that entry and 3 risers
