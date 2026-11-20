## MODIFIED Requirements

### Requirement: Openings
An opening SHALL be a `door` or a `window`, discriminated by `kind`. It SHALL name its host wall by
`wallId` and MAY name its design by `componentId`. It SHALL have an `offsetAlongWall`, `width`,
`height` and `sillHeight`. A door MAY have a `swing` of `{ hinge: start|end, side: left|right }`.
A window MAY have a `reveal` of `{ face: left|right, angle }`.

#### Scenario: Unknown opening kind
- **WHEN** an opening has `kind: "skylight"`
- **THEN** schema validation fails

#### Scenario: Window with a reveal
- **WHEN** a window has `reveal: { face: "left", angle: 45 }`
- **THEN** schema validation passes

#### Scenario: Door with a reveal
- **WHEN** a door has a `reveal`
- **THEN** schema validation fails, because doors do not have reveals

## ADDED Requirements

### Requirement: Splayed reveals
A window's `reveal` SHALL splay both jambs at `angle` degrees off square, from the middle of the
wall's thickness to the named `face`, looking from the wall's start to its end. The head, the sill
and the reveal from the middle to the other face SHALL stay square. The window's `width` SHALL be its
width in the middle of the wall. `angle` SHALL be more than 0 and less than 90.

#### Scenario: Width at the splayed face
- **WHEN** a 1200 mm window in a 400 mm wall has a 45° reveal
- **THEN** the opening is 1200 mm wide from the other face to the middle of the wall and 1600 mm wide at the splayed face

#### Scenario: Square reveal angle
- **WHEN** a window's reveal angle is `0`
- **THEN** schema validation fails

#### Scenario: Right-angle reveal
- **WHEN** a window's reveal angle is `90`
- **THEN** schema validation fails
