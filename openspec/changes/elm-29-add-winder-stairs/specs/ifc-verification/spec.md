# Spec Delta

## MODIFIED Requirements

### Requirement: Stair volumes

The round-trip SHALL expect a stair flight's volume to be its stepped profile area × its width, a
stair landing's to be its outline area × its thickness, and a stair winder's to be the sum, over its
treads, of the tread's plan area × its height above the winder's base. The `IfcStair` container
SHALL contribute no expected volume, because it has no body. These extend the _Expected volumes_
list, which keeps the wall, slab, door and window rules — including a window reveal's splay — as
they are.

#### Scenario: Stair flight volume

- **WHEN** a stair flight's IFC mesh volume differs from its stepped profile area × width
- **THEN** build reports an ERROR against that flight

#### Scenario: Stair landing volume

- **WHEN** a stair landing's IFC mesh volume differs from its outline area × thickness
- **THEN** build reports an ERROR against that landing

#### Scenario: Stair winder volume

- **WHEN** a stair winder's IFC mesh volume differs from the sum of its treads' plan areas × heights
- **THEN** build reports an ERROR against that winder

#### Scenario: Winder treads cover the outline

- **WHEN** a winder's treads are summed
- **THEN** their plan areas add up to the winder outline's area, so no part of the outline is left bare or counted twice

#### Scenario: Container expects no volume

- **WHEN** the round-trip lists what a stair contributes
- **THEN** its flights, landings and winders are listed and the `IfcStair` itself is not
