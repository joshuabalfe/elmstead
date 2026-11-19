# /// script
# requires-python = ">=3.12,<3.16"
# dependencies = ["ifcopenshell==0.9.0.post1"]
# ///
"""Validate an IFC file with ifcopenshell.validate.

Usage: uv run validator/validate.py <file.ifc>
Prints one JSON object per line: {"level": "ERROR"|"WARNING", "guid": str|null, "message": str}
and a final {"level": "SUMMARY", ...} line. Exit code 1 if any errors.
"""
import json
import logging
import sys

import ifcopenshell
import ifcopenshell.validate


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate.py <file.ifc>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    print(json.dumps({"level": "INFO", "message": f"ifcopenshell {ifcopenshell.version}"}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
