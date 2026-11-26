/**
 * Diff mode's colours and its plan drawing, apart from the viewer so they can be tested without a
 * browser. The scheme is GitHub's: a pale fill with a dark accent of the same hue, context plain.
 */
import type { DiffStatus, ModelDiff } from "../src/diff/index.js";
import type { Overlay } from "../src/render/plan.js";
import type { Node } from "../src/render/svg.js";

/**
 * Each status's colours: `fill` for an element, `accent` for its outline and plan wall pieces, and
 * `floor` for a slab or room fill in the plan drawing. A whole floor in an element's fill is far
 * more prominent than a window symbol in it, so floors take GitHub's subtler line-background tint,
 * as a diff line's background is subtler than its changed words.
 */
export const DIFF_COLOURS: Record<DiffStatus, { fill: string; accent: string; floor: string }> = {
  added: { fill: "#aceebb", accent: "#1a7f37", floor: "#e6ffec" },
  changed: { fill: "#fae17d", accent: "#9a6700", floor: "#fff8c5" },
  removed: { fill: "#ffcecb", accent: "#cf222e", floor: "#ffebe9" },
};

/** Each listed element's status, for the categories shown (the changes panel can hide each). */
export type StatusById = Map<string, DiffStatus>;

export function statusById(diff: ModelDiff, shown: Record<DiffStatus, boolean> = { added: true, changed: true, removed: true }): StatusById {
  const out: StatusById = new Map();
  for (const status of ["added", "changed", "removed"] as const) if (shown[status]) for (const e of diff[status]) out.set(e.id, status);
  return out;
}

const idOf = (n: Node): string | undefined => (typeof n.attrs["data-id"] === "string" ? n.attrs["data-id"] : undefined);
const painted = (paint: unknown): boolean => paint !== undefined && paint !== "none";

/**
 * An element's drawing in its status's colours. Wall pieces take the accent, as plan walls are solid
 * poché and a pale wall would vanish against the floor. Window symbols and door gaps take the fill,
 * with their strokes in the accent.
 */
function paint(n: Node, status: DiffStatus): Node {
  const c = DIFF_COLOURS[status];
  if (n.tag === "g") return { ...n, children: n.children.map((k) => paint(k, status)) };
  if (n.tag === "polygon" || n.tag === "polyline") {
    const wall = n.attrs.class === "wall";
    return {
      ...n,
      attrs: { ...n.attrs, ...(painted(n.attrs.fill) ? { fill: wall ? c.accent : c.fill } : {}), ...(!wall && painted(n.attrs.stroke) ? { stroke: c.accent } : {}) },
    };
  }
  if (n.tag === "line") return { ...n, attrs: { ...n.attrs, stroke: c.accent } };
  return n;
}

/** The wall-top drawing with each added and changed wall, window symbol and door gap in its colours. */
export function recolourPlan(o: Overlay, status: StatusById): Overlay {
  const visit = (n: Node): Node => {
    const s = status.get(idOf(n) ?? "");
    if (s === "added" || s === "changed") return paint(n, s);
    return n.tag === "g" ? { ...n, children: n.children.map(visit) } : n;
  };
  return { ...o, nodes: o.nodes.map(visit) };
}

/** Just the floor drawing's added and changed slab and room fills, in their floor tint; null when there are none. */
export function diffFloor(o: Overlay, status: StatusById): Overlay | null {
  const nodes = o.nodes.flatMap((n): Node[] => {
    const s = status.get(idOf(n) ?? "");
    return n.tag === "polygon" && (s === "added" || s === "changed") ? [{ ...n, attrs: { ...n.attrs, fill: DIFF_COLOURS[s].floor } }] : [];
  });
  return nodes.length ? { ...o, nodes } : null;
}

/** Just the floor drawing's door swings, to draw above the diff fills. */
export function doorSwings(o: Overlay): Overlay {
  return { ...o, nodes: o.nodes.filter((n) => n.tag === "g") };
}

/**
 * The removed walls, window symbols and door gaps from a drawing of the base storey: the removed
 * fill with a dashed outline in the accent; null when the storey lost none.
 */
export function removedPlan(o: Overlay, status: StatusById): Overlay | null {
  const c = DIFF_COLOURS.removed;
  const dashed = (n: Node): Node => {
    if (n.tag === "g") return { ...n, children: n.children.map(dashed) };
    if (n.tag === "polygon" || n.tag === "polyline") return { ...n, attrs: { ...n.attrs, fill: painted(n.attrs.fill) ? c.fill : "none", stroke: c.accent, "stroke-width": 1.5, "stroke-dasharray": "5 3" } };
    if (n.tag === "line") return { ...n, attrs: { ...n.attrs, stroke: c.accent } };
    return n;
  };
  const nodes = o.nodes.filter((n) => status.get(idOf(n) ?? "") === "removed").map(dashed);
  return nodes.length ? { ...o, nodes } : null;
}
