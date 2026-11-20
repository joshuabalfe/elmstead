## MODIFIED Requirements

### Requirement: Opening and component helpers
`door` and `window` SHALL make openings on a wall, linked to a component if given one. `door` SHALL
set `sillHeight: 0`. `window` SHALL take an optional reveal last, as `door` takes a swing.
`doorComponent` and `windowComponent` SHALL make designs. `centredOn` SHALL give the offset that
centres an opening on a plan coordinate.

#### Scenario: Door with a component
- **WHEN** `door("door-living", wall, offset, internalDoor, size)` is called
- **THEN** the door's `componentId` is `internalDoor.id` and its `sillHeight` is 0

#### Scenario: Centred window
- **WHEN** `centredOn(wall, at, width)` is used as a window's offset
- **THEN** the window's centre lies at plan coordinate `at` along that wall

#### Scenario: Window with a reveal
- **WHEN** `window("window-living", wall, offset, frontWindow, size, { face: "left", angle: deg(45) })` is called
- **THEN** the window's `reveal` is `{ face: "left", angle: 45 }`

#### Scenario: Window without a reveal
- **WHEN** `window` is called without a reveal
- **THEN** the window has no `reveal` field
