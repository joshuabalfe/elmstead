# Spec Delta

## ADDED Requirements

### Requirement: Railing helper
`railing(id, start, end, { height, startBase?, endBase? })` SHALL build a plain railing value. It
SHALL NOT compute levels, slope or post positions. It SHALL record the bases exactly as given and
SHALL omit both when neither is given; an omitted base means 0 to every consumer.

#### Scenario: Level railing helper
- **WHEN** `railing("railing-front", start, end, { height: mm(900) })` is called
- **THEN** it returns a railing with a 900 mm height and neither base stored

#### Scenario: Sloped railing helper
- **WHEN** `railing` is called with `startBase: mm(0)` and `endBase: mm(600)`
- **THEN** those offsets are recorded on the railing exactly as given

#### Scenario: One base omitted
- **WHEN** `railing` is called with `endBase: mm(600)` and no `startBase`
- **THEN** the stored railing has `endBase: 600` and no `startBase`, whose effective value is 0
