# Spec Delta

## ADDED Requirements

### Requirement: Ground presentation
The viewer SHALL recognise a ground slab's material as ground, not as a wall or concrete slab, and
present it in the ground colour in both plan style and 3D. In plan style the ground SHALL read as a
floor fill like other slabs, and the ground colour SHALL NOT disturb the plan-versus-3D comparison.

#### Scenario: Ground in 3D
- **WHEN** the viewer shows a ground slab in 3D or `?style=ifc`
- **THEN** its top face appears in the ground colour

#### Scenario: Ground in plan style
- **WHEN** the viewer shows a ground slab in plan style
- **THEN** the ground reads as a floor fill and the plan-versus-3D comparison is unchanged

## MODIFIED Requirements

### Requirement: Stair readability presentation
The viewer SHALL recolour stair solids so the steps read from above, in every mode including
snapshots and `?style=ifc`: upward faces alternate the floor cream with a darker cream, vertical
faces take the wall colour, and an edge outline reads the nosings. The recolour SHALL NOT change the
base material colour. Each stair SHALL band on its own riser height, so two stairs with different
risers band correctly side by side.

#### Scenario: Steps read from above
- **WHEN** the viewer shows a stair from the Top view, in any style or snapshot
- **THEN** alternate treads shade cream / darker cream, banded on the stair's riser height, and the
  nosings read as edges

#### Scenario: Two stairs with different risers
- **WHEN** a model has two stairs with different riser heights, such as the main stair and the front
  steps
- **THEN** each stair bands on its own riser height, not a shared value taken from the first stair

#### Scenario: Snapshots keep the readability presentation
- **WHEN** `render` writes a model's 3D snapshots
- **THEN** the stair appears in its cream readability presentation, not the base IFC colour