# Spec Delta

## Purpose

Furnishings are the movable and fixed contents of a room: furniture and sanitary fittings. A
furnishing is a kind from a closed catalogue, placed in plan and sized, whose shape is derived from
its kind and size so that plans, 3D views and IFC show a recognisable bed, chair or bath.

## ADDED Requirements

### Requirement: Furnishing shape

A furnishing SHALL have an id, an optional name, a `kind`, an `at` point, and optional `rotation`,
`elevationOffset`, `width`, `depth` and `height`. `rotation` SHALL be degrees and `elevationOffset`
a non-negative length; each size SHALL be positive. The schema SHALL NOT store any other geometry.

#### Scenario: Minimal furnishing

- **WHEN** a furnishing gives only an id, a kind and `at`
- **THEN** schema validation passes

#### Scenario: Zero size

- **WHEN** a furnishing's `width` is `0`
- **THEN** schema validation fails

#### Scenario: Negative elevation offset

- **WHEN** a furnishing's `elevationOffset` is `-50`
- **THEN** schema validation fails

#### Scenario: Unknown field

- **WHEN** a furnishing has a field the schema does not define, such as `colour`
- **THEN** schema validation fails

### Requirement: Catalogue of kinds

A furnishing's `kind` SHALL be one of `bed`, `chair`, `desk`, `file-cabinet`, `shelf`, `sofa` and
`table` (furniture) or `bath`, `shower`, `sink`, `toilet` and `wash-basin` (sanitary fittings). Any
other value SHALL fail schema validation.

#### Scenario: Known kind

- **WHEN** a furnishing's kind is `sofa`
- **THEN** schema validation passes

#### Scenario: Unknown kind

- **WHEN** a furnishing's kind is `armchair`
- **THEN** schema validation fails

### Requirement: Default and overridden sizes

Each kind SHALL have a default overall width, depth and height. An omitted size SHALL be that
default, and a given size SHALL replace only its own dimension.

#### Scenario: Defaults

- **WHEN** a chair omits `width`, `depth` and `height`
- **THEN** its overall size is the chair kind's default width, depth and height

#### Scenario: One override

- **WHEN** a bed gives `width: 900` and omits the other sizes
- **THEN** its width is 900 mm and its depth and height are the bed kind's defaults

### Requirement: Placement and rotation

`at` SHALL be the centre of the furnishing's footprint in the storey's plan. Directions are in plan
coordinates, as for walls and rooms, whatever the site's `northAngle`. At rotation 0, width SHALL run
along plan x and depth along plan y, with the front facing plan -y and the back facing plan +y. A
positive `rotation` SHALL turn the furnishing counter-clockwise about `at`, seen from above with plan
+y up. Its base SHALL sit at the storey elevation plus `elevationOffset`.

#### Scenario: Unrotated footprint

- **WHEN** a table 1500 mm wide and 800 mm deep is at (3000, 2000) with no rotation
- **THEN** its footprint spans x 2250 to 3750 and y 1600 to 2400

#### Scenario: Quarter turn

- **WHEN** the same table has `rotation: 90`
- **THEN** its footprint spans x 2600 to 3400 and y 1250 to 2750

#### Scenario: Back turns with the furnishing

- **WHEN** a bed is rotated 90 degrees
- **THEN** its back, which faced plan +y, faces plan -x

### Requirement: Parts fill the overall size

A furnishing's shape SHALL be a set of rectangular parts that do not overlap one another and that
together touch every face of the overall width, depth and height. Any positive overall size SHALL
produce valid parts.

#### Scenario: Chair is more than a box

- **WHEN** a chair's parts are derived
- **THEN** they include a seat, a back and legs, not a single block

#### Scenario: Bath is hollow

- **WHEN** a bath's parts are derived
- **THEN** a rim stands around a recessed floor, and no part fills the bath's interior

#### Scenario: Extent equals overall size

- **WHEN** the parts of any kind are measured with no rotation
- **THEN** their combined extent equals the furnishing's overall width, depth and height

#### Scenario: Parts do not overlap

- **WHEN** the parts of any kind are derived at its default size
- **THEN** no two parts share any volume

#### Scenario: Very small size

- **WHEN** a chair is given width, depth and height of 100 mm
- **THEN** its parts are still positive in every dimension and do not overlap
