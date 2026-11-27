import { describe, expect, it } from "vitest";
import { add, deg, div, divRound, m, mm, neg, scale, sub, toMetres, type Mm } from "../src/shared/schema/units.js";

describe("unit helpers", () => {
  it("mm() accepts whole millimetres", () => {
    expect(mm(200)).toBe(200);
    expect(mm(-150)).toBe(-150);
    expect(Object.is(mm(-0), 0)).toBe(true);
  });

  it("mm() rejects fractional and non-finite values", () => {
    expect(() => mm(200.5)).toThrow(/not a whole number/);
    expect(() => mm(Number.NaN)).toThrow();
    expect(() => mm(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("m() converts metres to mm, tolerating float noise", () => {
    expect(m(2.4)).toBe(2400);
    expect(m(0.1 + 0.2)).toBe(300);
    expect(m(8)).toBe(8000);
    expect(() => m(1.0005)).toThrow(/not a whole number/);
  });

  it("arithmetic helpers stay in Mm", () => {
    expect(add(m(1), mm(200), mm(50))).toBe(1250);
    expect(sub(m(8), mm(200))).toBe(7800);
    expect(neg(mm(5))).toBe(-5);
    expect(scale(mm(1000), 0.3333)).toBe(333);
    expect(div(m(8), 2)).toBe(4000);
    expect(() => div(mm(1001), 2)).toThrow();
    expect(divRound(mm(1001), 2)).toBe(501);
    expect(toMetres(m(2.4))).toBe(2.4);
  });

  it("deg() requires a finite number", () => {
    expect(deg(90)).toBe(90);
    expect(() => deg(Number.NaN)).toThrow();
  });

  it("a bare number is not assignable to Mm (checked by npm run typecheck)", () => {
    const takesMm = (x: Mm) => x;
    // @ts-expect-error bare numbers must go through mm()/m()
    takesMm(200);
    // @ts-expect-error arithmetic on Mm yields a plain number
    takesMm(mm(1) + mm(2));
    expect(takesMm(mm(200))).toBe(200);
  });
});
