# ifc-verification Specification

## Purpose
Two independent checks on every IFC that `build` writes:
- a geometry round-trip in web-ifc, which proves the file builds the geometry the model describes;
- IfcOpenShell validation, which proves the file is valid IFC4.

## Requirements

### Requirement: Geometry round-trip
`build` SHALL re-open the IFC in web-ifc, mesh every element and compare each element's mesh volume
with the volume expected from the model. A difference of more than 0.1% SHALL be an ERROR against
the element id. An element that produces no geometry SHALL be an ERROR.

#### Scenario: Missing geometry
- **WHEN** web-ifc produces no mesh for an element the model has
- **THEN** build reports an ERROR "round-trip: web-ifc produced no geometry for this …"

### Requirement: Expected volumes
The round-trip SHALL expect:
- wall: length × thickness × height, minus width × height × thickness for every opening in it;
- slab: outline area × thickness;
- door: width × height × 50 mm;
- window: pane area × 50 mm plus frame and bar area × 70 mm.

#### Scenario: Opening does not cut the wall
- **WHEN** a wall's IFC mesh still includes the volume of an opening in it
- **THEN** build reports an ERROR against that wall saying its volume differs from the model

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
The validator bridge SHALL parse each stdout line as one JSON object. A line that is not valid JSON
SHALL become an ERROR issue containing the offending line, and SHALL NOT throw or hide the
validator's summary.

#### Scenario: Non-JSON warning on stdout
- **WHEN** the validator prints `warning: something changed` before its JSON lines
- **THEN** build reports an ERROR quoting that line and still reports the validator's summary

#### Scenario: Malformed JSON finding
- **WHEN** a finding line is truncated JSON
- **THEN** build reports an ERROR quoting the line instead of throwing a syntax error

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
