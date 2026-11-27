# Spec Delta

## ADDED Requirements

### Requirement: Furnishing helper

`furnishing(id, kind, at, { name?, rotation?, elevationOffset?, width?, depth?, height? })` SHALL
build a plain furnishing value. It SHALL NOT compute parts, footprints or default sizes. It SHALL
record each option exactly as given and SHALL omit every option that is not given.

#### Scenario: Minimal furnishing helper

- **WHEN** `furnishing("sofa-living", "sofa", pt(mm(3000), mm(2000)))` is called
- **THEN** it returns a furnishing with that id, kind and position and no size, rotation or elevation stored

#### Scenario: Overrides recorded

- **WHEN** `furnishing` is called with `rotation: deg(90)` and `width: mm(900)`
- **THEN** the stored furnishing has that rotation and width and no depth or height

#### Scenario: Unknown kind is a type error

- **WHEN** a model passes a kind that is not in the catalogue, such as `"armchair"`
- **THEN** the model file fails type-checking
