# Spec Delta

## MODIFIED Requirements

### Requirement: Elements are matched by id

The diff SHALL match a revision's elements with its base model's by id. The compared kinds SHALL be
every element kind the id walk names on a storey, plus storeys and components, taken from the
element-kind table rather than a separate list. A stair SHALL be compared as a whole, including its
segments.

#### Scenario: Same id in both

- **WHEN** the base and the revision both have `wall-west`
- **THEN** the diff compares the two `wall-west` elements with each other

#### Scenario: Renamed element

- **WHEN** a revision removes `window-rear` and adds an identical window as `window-rear-new`
- **THEN** the diff reports `window-rear` as removed and `window-rear-new` as added

#### Scenario: Every storey kind is compared

- **WHEN** a revision changes one element of every storey kind — a wall, a door, a window, a slab, a room, a stair and a railing
- **THEN** the diff lists each of them as changed, with no kind skipped
