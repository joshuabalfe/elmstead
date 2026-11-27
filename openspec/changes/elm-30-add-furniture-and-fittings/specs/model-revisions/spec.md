# Spec Delta

## ADDED Requirements

### Requirement: Revisions can furnish a storey

`addTo` SHALL accept a `furnishings` collection, and `remove` and `replace` SHALL work on a
furnishing by id like any other element. A furnishing SHALL be replaced only by a furnishing.

#### Scenario: Furnish a storey in a revision

- **WHEN** a revision adds `{ furnishings: [bed, wardrobeShelf] }` to `storey-first`
- **THEN** both furnishings are in that storey's `furnishings` and the base model has none of them

#### Scenario: Replace a furnishing

- **WHEN** a revision replaces `sofa-living` with a furnishing of the same id and a different position
- **THEN** the revision's `sofa-living` is at the new position, in the same place in the list

#### Scenario: Remove a furnishing

- **WHEN** a revision removes `table-kitchen`
- **THEN** the revision has no element with that id and the base model still has it

#### Scenario: Wrong collection

- **WHEN** a revision replaces a furnishing with a railing of the same id
- **THEN** loading the revision fails with an ERROR naming that id
