# Spec Delta

## ADDED Requirements

### Requirement: Winder treads band with the stair

The viewer's stair riser height SHALL count a winder's risers with the flights', so a winder's treads
band on the same height as the flights that follow it.

#### Scenario: Stair with a winder

- **WHEN** a stair rises 2200 mm over a winder of 3 risers and a flight of 8 risers
- **THEN** the viewer bands that stair on 200 mm, not on 275 mm from counting the flight's risers alone
