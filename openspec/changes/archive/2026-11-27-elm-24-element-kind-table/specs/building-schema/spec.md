# Spec Delta

## ADDED Requirements

### Requirement: Element kind table

The id walk, revision validation and the diff SHALL take the storey collections and element kinds
they handle from one table beside the schema. A storey array added to the schema without a table
entry SHALL be a type error. The table SHALL yield the id walk's nodes in model order, components
last.

#### Scenario: Untabled collection

- **WHEN** a storey array is added to the schema but not to the element-kind table
- **THEN** `npm run typecheck` fails on the table's completeness constraint

#### Scenario: Every kind walked

- **WHEN** a model carries walls, openings, slabs, rooms, stairs with segments, railings and components
- **THEN** the id walk names each element once with its kind, storey and place, in model order, components last
