# Spec Delta

## MODIFIED Requirements

### Requirement: Plan coordinates

Each storey's plan SHALL use x east and y north, in mm. Heights SHALL be measured up from the
storey's `elevation`. `site.northAngle` SHALL be true north's angle counter-clockwise from plan +y,
defaulting to 0. `site.frontAngle` SHALL be the front's outward direction, counter-clockwise from
plan +y, defaulting to 180 (plan south).

#### Scenario: North angle omitted

- **WHEN** `site.northAngle` is left out
- **THEN** true north is taken as plan +y

#### Scenario: Front angle omitted

- **WHEN** `site.frontAngle` is left out
- **THEN** the front faces plan south
