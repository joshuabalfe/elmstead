# Spec Delta

## MODIFIED Requirements

### Requirement: Expected volumes
The round-trip SHALL expect:
- wall: side elevation area × thickness (length × height when flat), minus each opening's plan area
  within the wall × its height;
- slab: outline area × thickness;
- door: width × height × 50 mm, except a doorway, which has no filling;
- window: pane area × 50 mm plus frame and bar area × 70 mm.

An opening's plan area SHALL be width × thickness, plus splay × thickness / 2 for a window with a
reveal, where splay is half the thickness × tan(angle).

#### Scenario: Opening does not cut the wall
- **WHEN** a wall's IFC mesh still includes the volume of an opening in it
- **THEN** build reports an ERROR against that wall saying its volume differs from the model

#### Scenario: Splayed opening cut
- **WHEN** a 1200 mm by 1000 mm window in a 400 mm wall has a 45° reveal
- **THEN** the round-trip expects the wall to lose 0.52 m³ for it, not 0.48 m³

#### Scenario: Splay missing from the IFC
- **WHEN** a window has a reveal but its IFC opening is a square box
- **THEN** build reports an ERROR against the wall saying its volume differs from the model

#### Scenario: Gable wall volume
- **WHEN** a pitched wall's IFC mesh volume differs from the area under its top edge × its thickness, minus its openings
- **THEN** build reports an ERROR against that wall saying its volume differs from the model

#### Scenario: Gable running to the floor
- **WHEN** a pitched wall's top edge meets the floor at its ends, so its body is a triangle
- **THEN** the round-trip expects the triangle's area × thickness, the floor-touching stretches contributing no body

#### Scenario: Flat wall volume unchanged
- **WHEN** a flat wall with a `height` and no `profile` is round-tripped
- **THEN** the round-trip expects length × thickness × height, minus its openings, as before
