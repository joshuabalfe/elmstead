# Spec Delta

## MODIFIED Requirements

### Requirement: Geometry round-trip
`build` SHALL re-open the IFC in web-ifc, mesh every element expected to have a body and compare its
mesh volume with the volume expected from the model. A difference of more than 0.1% SHALL be an
ERROR against the element id. An expected element that produces no geometry SHALL be an ERROR.
Container elements that intentionally carry no body, such as `IfcStair`, SHALL NOT be reported as
missing.

#### Scenario: Missing geometry
- **WHEN** web-ifc produces no mesh for an element the model expects to have a body
- **THEN** build reports an ERROR "round-trip: web-ifc produced no geometry for this …"

#### Scenario: Stair container has no body
- **WHEN** a stair is written as an `IfcStair` container with flight and landing bodies
- **THEN** the round-trip does not report the stair container as missing geometry

## ADDED Requirements

### Requirement: Stair volumes
The round-trip SHALL expect a stair flight's volume to be its stepped profile area × its width, and
a stair landing's to be its outline area × its thickness. The `IfcStair` container SHALL contribute
no expected volume, because it has no body. These extend the *Expected volumes* list, which keeps
the wall, slab, door and window rules — including a window reveal's splay — as they are.

#### Scenario: Stair flight volume
- **WHEN** a stair flight's IFC mesh volume differs from its stepped profile area × width
- **THEN** build reports an ERROR against that flight

#### Scenario: Stair landing volume
- **WHEN** a stair landing's IFC mesh volume differs from its outline area × thickness
- **THEN** build reports an ERROR against that landing

#### Scenario: Container expects no volume
- **WHEN** the round-trip lists what a stair contributes
- **THEN** its flights and landings are listed and the `IfcStair` itself is not