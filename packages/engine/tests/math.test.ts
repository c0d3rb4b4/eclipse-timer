import { describe, expect, it } from "vitest";
import { evalPoly } from "../src/math/poly";
import { findBrackets } from "../src/math/bracket";
import { bisectRoot } from "../src/math/root";

function evalPolyNaive(coeffs: readonly number[], t: number): number {
  return coeffs.reduce((sum, c, i) => sum + c * t ** i, 0);
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("evalPoly", () => {
  it("evaluates known polynomials correctly", () => {
    expect(evalPoly([], 3)).toBe(0);
    expect(evalPoly([7], -100)).toBe(7);
    expect(evalPoly([2, -3, 5], 2)).toBe(16); // 2 - 6 + 20
    expect(evalPoly([1, 2, 3, 4], -1)).toBe(-2); // 1 - 2 + 3 - 4
  });

  it("matches naive polynomial evaluation for deterministic random vectors", () => {
    const rand = createRng(0x5eeda11);

    for (let n = 0; n < 200; n++) {
      const degree = 1 + Math.floor(rand() * 6);
      const coeffs = Array.from({ length: degree }, () => (rand() * 20 - 10));
      const t = rand() * 8 - 4;

      const horner = evalPoly(coeffs, t);
      const naive = evalPolyNaive(coeffs, t);
      expect(horner).toBeCloseTo(naive, 10);
    }
  });

  it("satisfies the Horner recurrence identity", () => {
    const coeffs = [3.2, -1.5, 0.8, 4.4, -0.1];
    const t = -2.75;
    const tail = coeffs.slice(1);

    const left = evalPoly(coeffs, t);
    const right = coeffs[0]! + t * evalPoly(tail, t);
    expect(left).toBeCloseTo(right, 12);
  });
});

describe("findBrackets", () => {
  it("finds expected sign-change brackets for a two-root function", () => {
    const f = (t: number) => (t + 1) * (t - 2);
    const brackets = findBrackets(f, -3, 3, 0.5);

    expect(brackets).toHaveLength(2);
    for (const b of brackets) {
      expect(b.a).toBeLessThan(b.b);
      expect(Number.isFinite(b.fa)).toBe(true);
      expect(Number.isFinite(b.fb)).toBe(true);
      expect(b.fa * b.fb).toBeLessThanOrEqual(0);
    }
  });

  it("captures roots not aligned to the scan step", () => {
    const f = (t: number) => t * t - 2;
    const brackets = findBrackets(f, 0, 2, 0.25);

    expect(brackets).toHaveLength(1);
    const b = brackets[0]!;
    expect(b.a).toBeLessThan(Math.SQRT2);
    expect(b.b).toBeGreaterThan(Math.SQRT2);
    expect(b.fa * b.fb).toBeLessThan(0);
  });

  it("skips non-finite values without throwing and still finds finite-root brackets", () => {
    const f = (t: number) => (t === 1 ? Number.NaN : t - 2);
    const brackets = findBrackets(f, 0, 4, 1);

    expect(brackets.length).toBeGreaterThan(0);
    const aroundTwo = brackets.find((b) => b.a <= 2 && b.b >= 2);
    expect(aroundTwo).toBeDefined();
  });

  it("returns brackets that obey sign-change guarantee in deterministic random linear cases", () => {
    const rand = createRng(0xabc12345);

    for (let i = 0; i < 120; i++) {
      const root = rand() * 6 - 3;
      const f = (t: number) => t - root;
      const brackets = findBrackets(f, -3, 3, 0.2);

      expect(brackets.length).toBeGreaterThan(0);
      for (const b of brackets) {
        expect(b.a).toBeLessThan(b.b);
        expect(Number.isFinite(b.fa)).toBe(true);
        expect(Number.isFinite(b.fb)).toBe(true);
        expect(b.fa * b.fb).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe("bisectRoot", () => {
  it("returns endpoint root when one endpoint is exactly zero", () => {
    const f = (t: number) => t - 2;
    expect(bisectRoot(f, 2, 5, 1e-12)).toEqual({ tHours: 2, ok: true, iterations: 0 });
    expect(bisectRoot(f, -1, 2, 1e-12)).toEqual({ tHours: 2, ok: true, iterations: 0 });
  });

  it("returns null when no root is bracketed or endpoint values are non-finite", () => {
    expect(bisectRoot((t) => t * t + 1, -1, 1, 1e-9)).toBeNull();
    expect(bisectRoot(() => Number.NaN, -1, 1, 1e-9)).toBeNull();
    expect(bisectRoot((t) => (t === 0 ? Number.NaN : t), -1, 1, 1e-9)).toBeNull();
  });

  it("converges to sqrt(2) within tolerance", () => {
    const result = bisectRoot((t) => t * t - 2, 1, 2, 1e-12);
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(true);
    expect(result!.iterations).toBeGreaterThan(0);
    expect(result!.tHours).toBeCloseTo(Math.SQRT2, 10);
    expect(Math.abs(result!.tHours * result!.tHours - 2)).toBeLessThan(1e-10);
  });

  it("reports ok=false when max iterations are exhausted", () => {
    const result = bisectRoot((t) => t - 0.123456, 0, 1, 1e-30, 3);
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
    expect(result!.iterations).toBe(3);
    expect(result!.tHours).toBeGreaterThan(0);
    expect(result!.tHours).toBeLessThan(1);
  });

  it("converges for deterministic random linear roots", () => {
    const rand = createRng(0x77777777);
    for (let i = 0; i < 120; i++) {
      const root = rand() * 20 - 10;
      const slope = rand() > 0.5 ? 1 : -1;
      const f = (t: number) => slope * (t - root);
      const tol = 1e-9;
      const result = bisectRoot(f, root - 5, root + 5, tol, 120);

      expect(result).not.toBeNull();
      expect(result!.ok).toBe(true);
      expect(Math.abs(result!.tHours - root)).toBeLessThanOrEqual(1.1 * tol);
      expect(Math.abs(f(result!.tHours))).toBeLessThan(1e-7);
    }
  });
});
