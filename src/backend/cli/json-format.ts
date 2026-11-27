/**
 * Deterministic JSON for out/*.building.json. Like JSON.stringify(v, null, 2), except that objects
 * and arrays made only of primitives (points, swings) go on one line when short, so a change to one
 * coordinate is a one-line diff.
 */
export function formatJson(value: unknown): string {
  return write(value, "") + "\n";
}

const MAX_INLINE = 72;

function isFlat(v: unknown): boolean {
  if (Array.isArray(v)) return v.every((x) => x === null || typeof x !== "object");
  if (v && typeof v === "object") return Object.values(v).every((x) => x === null || typeof x !== "object");
  return false;
}

function write(v: unknown, indent: string): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  const inner = indent + "  ";
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const items = v.map((x) => write(x, inner));
    const inline = `[${items.join(", ")}]`;
    if (isFlat(v) && inline.length <= MAX_INLINE) return inline;
    // Arrays of points stay one point per line.
    return `[\n${items.map((s) => inner + s).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  if (entries.length === 0) return "{}";
  const parts = entries.map(([k, x]) => `${JSON.stringify(k)}: ${write(x, inner)}`);
  const inline = `{ ${parts.join(", ")} }`;
  if (isFlat(v) && inline.length <= MAX_INLINE) return inline;
  return `{\n${parts.map((s) => inner + s).join(",\n")}\n${indent}}`;
}
