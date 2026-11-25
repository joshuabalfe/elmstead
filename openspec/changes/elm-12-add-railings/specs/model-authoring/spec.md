# Spec Delta

## ADDED Requirements

### Requirement: Railing helper
`railing(id, start, end, { height, startBase?, endBase? })` SHALL build a plain railing value. It
SHALL NOT compute levels, slope or post positions; the model supplies the plan points, the top-rail
height and the walking-surface offsets. Omitted bases SHALL be recorded as the same non-negative
offset, so a level run needs no bases.

#### Scenario: Level railing helper
- **WHEN** `railing("railing-front", start, end, { height: mm(900) })` is called
- **THEN** it returns a railing with a 900 mm height and no stored elevation difference

#### Scenario: Sloped railing helper
- **WHEN** `railing` is called with `startBase: mm(0)` and `endBase: mm(600)`
- **THEN** those offsets are recorded on the railing exactly as given
