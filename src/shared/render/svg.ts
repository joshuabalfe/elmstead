import type { Vec } from "../geometry/vec.js";

/** Fixed-precision number formatting so SVG output is byte-for-byte deterministic. */
export const num = (n: number): string => {
  const s = (Math.round(n * 10) / 10).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s === "-0" ? "0" : s;
};

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Presentation attributes, in the order they are written. The viewer reads them off the nodes too. */
export type Attrs = Record<string, string | number | undefined>;

/**
 * A drawing primitive: what the helpers below build and `serialise` writes as SVG. Coordinates are
 * SVG px (1 px = 10 mm, y down) at full precision; only the SVG rounds them. The 3D viewer draws
 * the same nodes as geometry.
 */
export type Node =
  | { tag: "polygon" | "polyline"; points: readonly Vec[]; attrs: Attrs }
  | { tag: "line"; from: Vec; to: Vec; attrs: Attrs }
  | { tag: "text"; at: Vec; text: string; attrs: Attrs }
  | { tag: "g"; attrs: Attrs; children: Node[] }
  /** Plan-sheet furniture (scale bar, north arrow) that only the SVG draws; `content` is raw. */
  | { tag: "rect" | "circle" | "style"; attrs: Attrs; content?: string };

const attrs = (a: Attrs): string =>
  Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === "number" ? num(v) : esc(v!)}"`)
    .join("");

const tag = (name: string, a: Attrs, children?: string): string =>
  children === undefined ? `<${name}${attrs(a)}/>` : `<${name}${attrs(a)}>${children}</${name}>`;

export const pointsAttr = (pts: readonly Vec[]): string => pts.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");

export const el = (name: "rect" | "circle" | "style", a: Attrs, content?: string): Node =>
  content === undefined ? { tag: name, attrs: a } : { tag: name, attrs: a, content };
export const polygon = (points: readonly Vec[], a: Attrs): Node => ({ tag: "polygon", points, attrs: a });
export const polyline = (points: readonly Vec[], a: Attrs): Node => ({
  tag: "polyline",
  points,
  attrs: { fill: "none", ...a },
});
export const line = (from: Vec, to: Vec, a: Attrs): Node => ({ tag: "line", from, to, attrs: a });
export const text = (at: Vec, s: string, a: Attrs): Node => ({ tag: "text", at, text: s, attrs: a });
export const group = (a: Attrs, children: Node[]): Node => ({ tag: "g", attrs: a, children });

/** The node as SVG markup. */
export function serialise(node: Node): string {
  switch (node.tag) {
    case "polygon":
    case "polyline":
      return tag(node.tag, { points: pointsAttr(node.points), ...node.attrs });
    case "line":
      return tag("line", { x1: node.from.x, y1: node.from.y, x2: node.to.x, y2: node.to.y, ...node.attrs });
    case "text":
      return tag("text", { x: node.at.x, y: node.at.y, ...node.attrs }, esc(node.text));
    case "g":
      return tag("g", node.attrs, "\n" + node.children.map(serialise).join("\n") + "\n");
    default:
      return tag(node.tag, node.attrs, node.content);
  }
}
