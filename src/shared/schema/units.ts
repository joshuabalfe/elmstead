import { z } from "zod";

/** Integer millimetres. The brand stops a bare number being used where a length is expected. */
export const MmSchema = z.int().brand<"Mm">();
export type Mm = z.infer<typeof MmSchema>;
export const PositiveMmSchema = z.int().positive().brand<"Mm">();
export const NonNegativeMmSchema = z.int().nonnegative().brand<"Mm">();

/** Degrees. Each field documents its zero direction and sense. */
export const DegSchema = z.number().refine(Number.isFinite, "must be finite").brand<"Deg">();
export type Deg = z.infer<typeof DegSchema>;
/** Degrees strictly between `min` and `max`, a range JSON Schema can carry, unlike a refinement. */
export const degBetween = (min: number, max: number) => z.number().gt(min).lt(max).brand<"Deg">();

const EPS = 1e-6;

function toIntMm(value: number, label: string): Mm {
  const rounded = Math.round(value);
  if (!Number.isFinite(value) || Math.abs(value - rounded) > EPS) {
    throw new RangeError(`${label}: ${value} is not a whole number of millimetres`);
  }
  return (rounded === 0 ? 0 : rounded) as Mm; // normalise -0
}

/** Millimetres. Throws on fractional values; use `scale` or `divRound` for deliberate rounding. */
export const mm = (n: number): Mm => toIntMm(n, `mm(${n})`);

/** Metres, converted to millimetres. `m(2.4)` is 2400 mm. Throws if it is not a whole number of mm. */
export const m = (n: number): Mm => toIntMm(n * 1000, `m(${n})`);

export const deg = (n: number): Deg => {
  if (!Number.isFinite(n)) throw new RangeError(`deg(${n}) is not finite`);
  return n as Deg;
};

export const add = (...xs: Mm[]): Mm => xs.reduce<number>((a, b) => a + b, 0) as Mm;
export const sub = (a: Mm, b: Mm): Mm => (a - b) as Mm;
export const neg = (a: Mm): Mm => (a === 0 ? 0 : -a) as Mm;
/** Multiply by a dimensionless factor, rounding to the nearest mm. */
export const scale = (a: Mm, k: number): Mm => toIntMm(Math.round(a * k), `scale(${a}, ${k})`);
/** Exact division; throws if the result is not a whole number of mm. */
export const div = (a: Mm, k: number): Mm => toIntMm(a / k, `div(${a}, ${k})`);
/** Division rounded to the nearest mm. */
export const divRound = (a: Mm, k: number): Mm => scale(a, 1 / k);

export const toMetres = (a: Mm): number => a / 1000;
