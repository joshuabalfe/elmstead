# ifc-verification Specification

## Purpose
Two independent checks on every IFC that `build` writes:
- a geometry round-trip in web-ifc, which proves the file builds the geometry the model describes;
- IfcOpenShell validation, which proves the file is valid IFC4.

## Requirements

### Requirement: Geometry round-trip
`build` SHALL re-open the IFC in web-ifc, mesh every element expected to have a body and compare its
mesh volume with the volume expected from the model. A difference of more than 0.1% SHALL be an
ERROR against the element id. An expected element that produces no geometry SHALL be an ERROR.
Container elements that intentionally carry no body, such as `IfcStair`, SHALL NOT be reported as
missing.

#### Scenario: Missing geometry
- **WHEN** web-ifc produces no mesh for an element the model expects to have a body
- **THEN** build reports an ERROR "round-trip: web-ifc produced no geometry for this …"

#### Scenario: Stair container has no body
- **WHEN** a stair is written as an `IfcStair` container with flight and landing bodies
- **THEN** the round-trip does not report the stair container as missing geometry

### Requirement: Expected volumes
The round-trip SHALL expect:
- wall: side elevation area × thickness (length × height when flat), minus each opening's plan area
  within the wall × its height;
- slab: outline area × thickness;
- door: width × height × 50 mm, except a doorway, which has no filling;
- window: pane area × 50 mm plus frame and bar area × 70 mm.

An opening's plan area SHALL be width × thickness, plus splay × thickness / 2 for a window with a
reveal, where splay is half the thickness × tan(angle).

#### Scenario: Opening does not cut the wall
- **WHEN** a wall's IFC mesh still includes the volume of an opening in it
- **THEN** build reports an ERROR against that wall saying its volume differs from the model

#### Scenario: Splayed opening cut
- **WHEN** a 1200 mm by 1000 mm window in a 400 mm wall has a 45° reveal
- **THEN** the round-trip expects the wall to lose 0.52 m³ for it, not 0.48 m³

#### Scenario: Splay missing from the IFC
- **WHEN** a window has a reveal but its IFC opening is a square box
- **THEN** build reports an ERROR against the wall saying its volume differs from the model

#### Scenario: Gable wall volume
- **WHEN** a pitched wall's IFC mesh volume differs from the area under its top edge × its thickness, minus its openings
- **THEN** build reports an ERROR against that wall saying its volume differs from the model

#### Scenario: Gable running to the floor
- **WHEN** a pitched wall's top edge meets the floor at its ends, so its body is a triangle
- **THEN** the round-trip expects the triangle's area × thickness, the floor-touching stretches contributing no body

#### Scenario: Flat wall volume unchanged
- **WHEN** a flat wall with a `height` and no `profile` is round-tripped
- **THEN** the round-trip expects length × thickness × height, minus its openings, as before

### Requirement: IfcOpenShell validation
`build` SHALL run `validator/validate.py` with `uv run`. The script SHALL pin
`ifcopenshell==0.9.0.post1` and run `ifcopenshell.validate` with EXPRESS rules. It SHALL check
entity and attribute types, inverse attributes and IFC4 where-rules. Each finding SHALL become an
issue with the prefix `ifc:`, against the model id of the element that owns the offending entity.

#### Scenario: Where-rule failure
- **WHEN** a wall is written with a non-positive extrusion depth
- **THEN** build reports `ERROR   wall-…: ifc: … IfcPositiveLengthMeasure.WR1`

#### Scenario: uv missing
- **WHEN** `uv` is not installed
- **THEN** build reports an ERROR "could not run uv — install it with: brew install uv"

#### Scenario: Validator crash
- **WHEN** the validator exits without printing its summary line
- **THEN** build reports an ERROR "validator crashed" with the last lines of its stderr

### Requirement: Validator output is parsed defensively
The validator bridge SHALL parse each stdout line as one JSON object of the expected shape. A line
that is not valid JSON, or whose fields have the wrong types, SHALL become an ERROR issue
containing the offending line, and SHALL NOT throw or hide the validator's summary.

#### Scenario: Non-JSON warning on stdout
- **WHEN** the validator prints `warning: something changed` before its JSON lines
- **THEN** build reports an ERROR quoting that line and still reports the validator's summary

#### Scenario: Malformed JSON finding
- **WHEN** a finding line is truncated JSON
- **THEN** build reports an ERROR quoting the line instead of throwing a syntax error

#### Scenario: Finding line with the wrong shape
- **WHEN** a line is valid JSON but not a validator line, such as `[1]` or `{"level":5}`
- **THEN** build reports an ERROR "validator line has an unexpected shape" quoting the line

### Requirement: Validator invocation is location-independent
The validator SHALL be found relative to the project root, not the process working directory. The
validator's exit status SHALL be considered: exit 1 means validation findings and is normal when a
summary is printed; no parseable summary, or any other exit status, SHALL be an ERROR. The reported
error count SHALL include unparseable output lines.

#### Scenario: Run from another directory
- **WHEN** `build` is invoked from a directory other than the project root
- **THEN** it finds `validator/validate.py` and runs it normally

#### Scenario: Validator exits non-zero without a summary
- **WHEN** the validator exits with status 2 and prints no summary line
- **THEN** build reports an ERROR with the last lines of its stderr

#### Scenario: Validator reports findings
- **WHEN** the validator exits with status 1 and prints a summary with errors
- **THEN** build reports the findings normally and does not call the validator crashed

### Requirement: Stair volumes
The round-trip SHALL expect a stair flight's volume to be its stepped profile area × its width, and
a stair landing's to be its outline area × its thickness. The `IfcStair` container SHALL contribute
no expected volume, because it has no body. These extend the *Expected volumes* list, which keeps
the wall, slab, door and window rules — including a window reveal's splay — as they are.

#### Scenario: Stair flight volume
- **WHEN** a stair flight's IFC mesh volume differs from its stepped profile area × width
- **THEN** build reports an ERROR against that flight

#### Scenario: Stair landing volume
- **WHEN** a stair landing's IFC mesh volume differs from its outline area × thickness
- **THEN** build reports an ERROR against that landing

#### Scenario: Container expects no volume
- **WHEN** the round-trip lists what a stair contributes
- **THEN** its flights and landings are listed and the `IfcStair` itself is not

### Requirement: Railing volumes
The round-trip SHALL expect a railing's volume to be its 3D length × 50 mm × 40 mm plus each post's
40 mm × 40 mm × height. A post runs from the walking surface to the top of the rail, so the
post/rail overlap is counted in both the expected and mesh volumes. This extends the *Expected
volumes* list, which keeps the wall, slab, door and window rules — including a window reveal's
splay — as they are.

#### Scenario: Railing volume
- **WHEN** a railing's IFC mesh volume differs from its rail plus post volumes
- **THEN** build reports an ERROR against that railing

#### Scenario: Railing parts add up
- **WHEN** the round-trip lists what a railing contributes
- **THEN** the top rail and every post are counted, and no extra body is expected
