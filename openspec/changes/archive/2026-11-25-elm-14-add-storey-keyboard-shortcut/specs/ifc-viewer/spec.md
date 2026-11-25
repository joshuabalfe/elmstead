# Spec Delta

## ADDED Requirements

### Requirement: Storey keyboard shortcut
Arrow Up SHALL show the next storey above the highest storey now shown, and Arrow Down SHALL hide the highest storey now shown, each with the same effect as choosing the resulting floor in the storey selector. Neither SHALL wrap: Arrow Up with the topmost storey shown, and Arrow Down with only the lowest storey shown, SHALL do nothing.

#### Scenario: Step up
- **WHEN** a two-storey model shows only its ground storey and the user presses Arrow Up
- **THEN** both storeys are drawn, the selector shows the upper storey, the URL has no `storeys` parameter, and the camera has not moved

#### Scenario: Step down
- **WHEN** every storey of a two-storey model is shown and the user presses Arrow Down
- **THEN** only the ground storey is drawn, the selector shows it, `?storeys=` names it, and the camera has not moved

#### Scenario: No wrap at the top
- **WHEN** the topmost storey is shown and the user presses Arrow Up
- **THEN** nothing changes

#### Scenario: No wrap at the bottom
- **WHEN** only the lowest storey is shown and the user presses Arrow Down
- **THEN** nothing changes

#### Scenario: Custom selection
- **WHEN** `?storeys=` shows a set no floor's prefix describes and the user presses Arrow Up or Arrow Down
- **THEN** the step starts from the highest storey shown, and the result is a floor's prefix

### Requirement: Storey shortcut scope
The storey shortcut SHALL be ignored in walk mode, where the arrows keep walking, with Ctrl, Alt, Meta or Shift held, for a single-storey model, in snapshot mode, while a form control other than the storey selector has focus, for an auto-repeated key press, and while an earlier step is still being drawn. While the storey selector has focus the shortcut SHALL still step it, and the browser's own arrow-key handling for it SHALL NOT also act. The selector's tooltip SHALL name the keys.

#### Scenario: Walk mode
- **WHEN** walk mode is active and the user presses Arrow Up or Arrow Down
- **THEN** the camera walks and the storey selection does not change

#### Scenario: Single storey
- **WHEN** the model has one storey and the user presses Arrow Up or Arrow Down
- **THEN** nothing changes

#### Scenario: Held key
- **WHEN** the user holds Arrow Down on a three-storey model
- **THEN** the selection steps down once, not once per auto-repeat

#### Scenario: Selector focused
- **WHEN** the user has just chosen a floor from the selector, which keeps focus, and presses Arrow Down
- **THEN** the selector steps down exactly one floor

#### Scenario: Other control focused
- **WHEN** the model selector has focus and the user presses Arrow Up
- **THEN** the storey selection does not change

#### Scenario: Modifier held
- **WHEN** the user presses Shift+Arrow Up
- **THEN** the storey selection does not change
