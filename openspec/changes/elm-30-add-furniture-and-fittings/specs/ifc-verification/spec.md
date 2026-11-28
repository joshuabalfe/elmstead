# Spec Delta

## ADDED Requirements

### Requirement: Furnishing volumes

The round-trip SHALL expect a furnishing's volume to be the sum of its parts' volumes at its
effective size. Parts do not overlap, so nothing is counted twice. This extends the _Expected
volumes_ list, which keeps its other rules as they are.

#### Scenario: Furnishing volume

- **WHEN** a furnishing's IFC mesh volume differs from the sum of its part volumes
- **THEN** build reports an ERROR against that furnishing

#### Scenario: Rotation does not change volume

- **WHEN** the same chair is exported at rotation 0 and at rotation 37
- **THEN** both round-trip against the same expected volume

#### Scenario: Hollow fittings

- **WHEN** a bath is round-tripped
- **THEN** its expected volume is that of its rim and floor, not of its overall box

#### Scenario: Overridden size

- **WHEN** a bed gives `width: 900`
- **THEN** its expected volume is that of the parts derived for a 900 mm width

### Requirement: Furnishing classification validates

The IFC validator SHALL accept furnishing types and elements. A furniture or sanitary type whose
predefined type is `USERDEFINED` without an element type SHALL NOT be written.

#### Scenario: Validator passes a furnished model

- **WHEN** a model with every kind of furnishing is built
- **THEN** IfcOpenShell validation reports no errors

#### Scenario: Predefined types are never user-defined

- **WHEN** every kind in the catalogue is exported
- **THEN** none of its types has `PredefinedType` `USERDEFINED` or `NOTDEFINED`
