# Spec Delta

## ADDED Requirements

### Requirement: External storey
A storey MAY represent external ground: its elevation MAY be below the building's ground floor
(negative), it MAY have no rooms, and it MAY hold external works such as a ground slab and a stair
climbing to the lowest internal storey. The schema SHALL validate such a storey like any other.

#### Scenario: Below-grade storey with a stair to the ground floor
- **WHEN** a storey at -450 mm has a stair whose `toStoreyId` is the ground storey at 0 mm
- **THEN** schema validation passes

#### Scenario: External storey without rooms
- **WHEN** a storey has empty `walls`, `openings` and `rooms` arrays and a ground slab
- **THEN** schema validation passes

### Requirement: Slab material
A slab MAY have a `material` of `concrete` or `ground`, defaulting to `concrete` when omitted. The
material SHALL only select the slab's presentation colour and SHALL NOT change its geometry.

#### Scenario: Ground material accepted
- **WHEN** a slab has `material: "ground"`
- **THEN** schema validation passes

#### Scenario: Material omitted
- **WHEN** a slab omits `material`
- **THEN** schema validation passes and consumers treat the slab as `concrete`

#### Scenario: Unknown material rejected
- **WHEN** a slab has `material: "timber"`
- **THEN** schema validation fails

## MODIFIED Requirements

### Requirement: Slabs and rooms
A slab SHALL have an outline, a thickness and an `elevationOffset` for its top relative to the
storey, and MAY have a `material` (see Slab material). A room SHALL have a non-empty name and an
outline. Outlines SHALL be open polygons of at least three points.

#### Scenario: Two-point outline
- **WHEN** a room outline has two points
- **THEN** schema validation fails