import type { Vec } from "../geometry/vec.js";

/** Fixed-precision number formatting so SVG output is byte-for-byte deterministic. */
export const num = (n: number): string => {
  const s = (Math.round(n * 10) / 10).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s === "-0" ? "0" : s;
};

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Attrs = Record<string, string | number | undefined>;

const attrs = (a: Attrs): string =>
  Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === "number" ? num(v) : esc(v!)}"`)
    .join("");

export const el = (tag: string, a: Attrs, children?: string): string =>
  children === undefined ? `<${tag}${attrs(a)}/>` : `<${tag}${attrs(a)}>${children}</${tag}>`;

export const pointsAttr = (pts: readonly Vec[]): string => pts.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");

export const polygon = (pts: readonly Vec[], a: Attrs) => el("polygon", { points: pointsAttr(pts), ...a });
export const polyline = (pts: readonly Vec[], a: Attrs) => el("polyline", { points: pointsAttr(pts), fill: "none", ...a });
export const line = (p: Vec, q: Vec, a: Attrs) => el("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, ...a });
export const text = (p: Vec, s: string, a: Attrs) => el("text", { x: p.x, y: p.y, ...a }, esc(s));
export const group = (a: Attrs, children: string[]) => el("g", a, "\n" + children.join("\n") + "\n");
