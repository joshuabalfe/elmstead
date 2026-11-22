import type { ResolvedConstraint } from "../src/constraints/check.js";

/** One constraint label: its text lines and plan anchor in millimetres. */
export interface ConstraintLabel {
  at: { x: number; y: number };
  /** One line per constraint, `<id> <distance>`. */
  lines: string[];
}

/**
 * The constraints on one storey as labels, one line each, placed at the middle of the span its
 * measurement covers. Constraints that share a midpoint share a label, so they stack instead of
 * overprinting. The order follows the input, the build's order.
 */
export function constraintLabels(constraints: readonly ResolvedConstraint[], storey: string): ConstraintLabel[] {
  const groups = new Map<string, ConstraintLabel>();
  for (const c of constraints) {
    if (c.storey !== storey) continue;
    const [sx, sy] = [c.span.from.x + c.span.to.x, c.span.from.y + c.span.to.y];
    const key = `${sx}:${sy}`;
    let label = groups.get(key);
    if (!label) {
      label = { at: { x: sx / 2, y: sy / 2 }, lines: [] };
      groups.set(key, label);
    }
    label.lines.push(`${c.id} ${c.distance}`);
  }
  return [...groups.values()];
}