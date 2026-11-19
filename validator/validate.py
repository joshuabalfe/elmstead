# /// script
# requires-python = ">=3.12,<3.16"
# dependencies = ["ifcopenshell==0.9.0.post1", "pytest==9.2.0"]  # pytest: required by IfcOpenShell's EXPRESS rule executor
# ///
"""Validate an IFC file with ifcopenshell.validate (schema, types, inverses and EXPRESS where-rules).

Usage: uv run validator/validate.py <file.ifc>
       uv run validator/validate.py --version

Prints one JSON object per line:
  {"level": "ERROR"|"WARNING", "id": <Tag or GlobalId or #step-id>, "entity": str|null, "message": str}
then a final {"level": "SUMMARY", "errors": n, "warnings": n}. Exit code 1 if there are errors.
This script only reports; it holds no building logic.
"""
import json
import re
import sys

import ifcopenshell
import ifcopenshell.validate


STEP_ID = re.compile(r"#(\d+)\s*=")


def owner(f, instance, max_depth=8):
    """The nearest IfcRoot with a Tag or GlobalId that (transitively) references `instance`."""
    seen, frontier = {instance.id()}, [instance]
    for _ in range(max_depth):
        nxt = []
        for inst in frontier:
            for ref in f.get_inverse(inst):
                if ref.id() in seen:
                    continue
                seen.add(ref.id())
                if getattr(ref, "Tag", None) or (ref.is_a("IfcRoot") and not ref.is_a("IfcRelationship")):
                    return ref
                nxt.append(ref)
        frontier = nxt
    return None


def describe(f, instance):
    """Best LLM-readable identifier: our element id (Tag), else GlobalId, else #n — via the owning element."""
    if instance is None:
        return None, None
    if isinstance(instance, str):  # parse-level errors give the raw STEP line
        m = STEP_ID.search(instance)
        if not (f and m):
            return instance[:60], None
        try:
            instance = f.by_id(int(m.group(1)))
        except Exception:
            return f"#{m.group(1)}", None
    try:
        entity = instance.is_a()
    except Exception:
        return str(instance)[:60], None
    for attr in ("Tag", "GlobalId"):
        value = getattr(instance, attr, None)
        if value:
            return str(value), entity
    parent = owner(f, instance) if f else None
    if parent is not None:
        return str(getattr(parent, "Tag", None) or parent.GlobalId), f"{entity} #{instance.id()} in {parent.is_a()}"
    return f"#{instance.id()}", entity


def main() -> int:
    if sys.argv[1:] == ["--version"]:
        print(f"ifcopenshell {ifcopenshell.version}")
        return 0
    if len(sys.argv) != 2:
        print("usage: validate.py <file.ifc>", file=sys.stderr)
        return 2

    path = sys.argv[1]
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(path, logger, express_rules=True)
    try:
        f = ifcopenshell.open(path)  # for mapping findings back to element ids
    except Exception:
        f = None

    counts = {"ERROR": 0, "WARNING": 0}
    for s in logger.statements:
        level = "ERROR" if s["level"].lower() in ("error", "critical") else "WARNING"
        counts[level] += 1
        ident, entity = describe(f, s.get("instance"))
        attribute = s.get("attribute")
        message = " ".join(s["message"].split())
        if attribute:
            message = f"{attribute}: {message}"
        print(json.dumps({"level": level, "id": ident, "entity": entity, "message": message}))

    print(json.dumps({"level": "SUMMARY", "errors": counts["ERROR"], "warnings": counts["WARNING"]}))
    return 1 if counts["ERROR"] else 0


if __name__ == "__main__":
    sys.exit(main())
