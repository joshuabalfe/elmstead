# Spec Delta

## ADDED Requirements

### Requirement: Ids toggle
The viewer SHALL provide an **Ids** button that toggles hover identification, and `?ids=0|1` SHALL
set it at load. Hover identification SHALL start off. Snapshots SHALL ignore the button and the
parameter.

#### Scenario: Ids button on
- **WHEN** the user presses **Ids**
- **THEN** hover identification turns on and the button shows it is active

#### Scenario: Ids button off
- **WHEN** the user presses **Ids** while hover identification is on
- **THEN** hover identification turns off and any tooltip is hidden

#### Scenario: URL entry
- **WHEN** the viewer is opened with `?ids=1`
- **THEN** hover identification starts on

#### Scenario: Default
- **WHEN** the viewer is opened without `ids` in the URL
- **THEN** hover identification is off and hovering shows no tooltip

#### Scenario: Snapshot
- **WHEN** the viewer is opened with `?snapshot=1&ids=1`
- **THEN** no tooltip or Ids control is shown and the snapshot is unchanged

### Requirement: Hover identification
While hover identification is on, the viewer SHALL show a tooltip beside the cursor when the
pointer is over an element's geometry, stating the element's model id, and its name when it has
one distinct from the id. The tooltip SHALL follow the pointer, name the element currently under
it, and hide when the pointer is over no model geometry.

#### Scenario: Hover a wall
- **WHEN** the pointer rests over a wall with hover identification on
- **THEN** a tooltip beside the cursor shows that wall's model id

#### Scenario: Element with a name
- **WHEN** the pointer rests over an element whose name differs from its id
- **THEN** the tooltip shows both the id and the name

#### Scenario: Off the model
- **WHEN** the pointer moves off all model geometry
- **THEN** the tooltip hides

#### Scenario: Moving between elements
- **WHEN** the pointer moves from one element to another
- **THEN** the tooltip updates to the element now under the pointer

#### Scenario: Model change
- **WHEN** the user selects another model while a tooltip is showing
- **THEN** the tooltip hides until the pointer identifies an element of the new model

### Requirement: Hover is passive
Hover identification SHALL NOT capture clicks or change navigation. With hover identification on,
drags SHALL pan or orbit as before, and clicks in measure mode SHALL still pick measurement
points.

#### Scenario: Drag with Ids on
- **WHEN** the user drags to pan or orbit with hover identification on
- **THEN** the view navigates as it does with hover identification off

#### Scenario: Measure with Ids on
- **WHEN** the user clicks two points in measure mode with hover identification on
- **THEN** the measurement is created as usual and the tooltip does not block the picks

### Requirement: Hover follows shown storeys
The tooltip SHALL name only elements the current storey selection shows. Hovering where a hidden
storey's elements lie SHALL identify the visible element under the pointer, or nothing.

#### Scenario: Hidden storey
- **WHEN** the storey selector hides a storey and the pointer rests where one of its walls would be
- **THEN** the tooltip names a shown element under the pointer, or no tooltip is shown

### Requirement: Hover inactive in walk mode
While walking, the viewer SHALL show no hover tooltip. Leaving walk mode SHALL restore hover
identification when it is on.

#### Scenario: Walking
- **WHEN** the user enters walk mode with hover identification on
- **THEN** no tooltip is shown while walking

#### Scenario: Leaving walk mode
- **WHEN** the user leaves walk mode with hover identification on
- **THEN** hovering the model shows tooltips again