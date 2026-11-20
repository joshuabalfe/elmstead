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

### Requirement: Expected volumes
The round-trip SHALL expect:
- wall: length × thickness × height, minus width × height × thickness for every opening in it;
- slab: outline area × thickness;
- door: width × height × 50 mm;
- window: pane area × 50 mm plus frame and bar area × 70 mm;
- stair flight: stepped profile area × width;
- stair landing: outline area × thickness.

#### Scenario: Opening does not cut the wall
- **WHEN** a wall's IFC mesh still includes the volume of an opening in it
- **THEN** build reports an ERROR against that wall saying its volume differs from the model

#### Scenario: Stair flight volume
- **WHEN** a stair flight's IFC mesh volume differs from its stepped profile area × width
- **THEN** build reports an ERROR against that flight

#### Scenario: Stair landing volume
- **WHEN** a stair landing's IFC mesh volume differs from its outline area × thickness
- **THEN** build reports an ERROR against that landing