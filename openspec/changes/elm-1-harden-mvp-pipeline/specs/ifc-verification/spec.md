# Spec Delta

## ADDED Requirements

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