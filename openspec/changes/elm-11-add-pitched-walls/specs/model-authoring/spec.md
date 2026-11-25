# Spec Delta

## MODIFIED Requirements

### Requirement: Wall and room helpers
The helpers SHALL only build plain schema values. `defineBuilding` SHALL fill in `schemaVersion`.
`wall` SHALL be centre-justified by default. `rectWalls` SHALL make four left-justified
external walls, counter-clockwise, whose outer faces form the given rectangle. `face` SHALL give the
coordinate of a named face of an axis-aligned wall, `faceCrossing` where a face of a wall at any
angle crosses a given x or y, and `rectRoom` a rectangular room.

#### Scenario: Rectangle of external walls
- **WHEN** `rectWalls("wall", pt(0,0), m(8), m(6), { thickness: mm(200), … })` is called
- **THEN** the walls' outer faces lie on x=0, x=8000, y=0 and y=6000, and their corners neither overlap nor leave gaps

#### Scenario: Pitched wall helper
- **WHEN** `wall("wall-gable", start, end, { thickness, profile, justification })` is called with a top-edge profile
- **THEN** it returns a wall carrying that `profile` and no `height`

#### Scenario: Flat wall helper unchanged
- **WHEN** `wall("wall-flat", start, end, { thickness, height, justification })` is called with a height
- **THEN** it returns a wall carrying that `height` and no `profile`
