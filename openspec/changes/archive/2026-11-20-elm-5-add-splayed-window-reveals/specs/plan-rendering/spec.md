## MODIFIED Requirements

### Requirement: Plan geometry
The plan SHALL draw, in order:
1. slab outlines, dashed;
2. room fills;
3. walls at their true thickness, split around openings, and cut to the splayed outline of a window with a reveal;
4. door leaves with swing arcs;
5. window symbols: an outline, two glazing lines, and a block for each frame piece or vertical bar the cut passes through. The outline SHALL follow a window's reveal, and so SHALL the dashed outline of a window the cut misses.

#### Scenario: Door in a wall
- **WHEN** a wall has a door
- **THEN** the wall is drawn in pieces either side of the opening and the door shows a leaf and swing arc on the side it opens to

#### Scenario: Window with a reveal
- **WHEN** a window the cut passes through has a reveal on its wall's left face
- **THEN** the wall pieces either side end square from the right face to the middle and angled from the middle to the left face, and the window's outline fills the splayed gap
