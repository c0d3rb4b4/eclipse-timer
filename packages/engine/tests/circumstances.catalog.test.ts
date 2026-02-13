import { describe, expect, it } from "vitest";
import type { EclipseKind, EclipseRecord } from "@eclipse-timer/shared";
import generatedCatalog from "../../catalog/generated/catalog.generated.json";
import sampleCatalog from "../../catalog/src/catalog.sample.json";
import { computeCircumstances } from "../src/circumstances/compute";
import { fPenumbra, fUmbraAbs } from "../src/circumstances/functions";

function normalizeKind(kind: string): EclipseKind {
  if (kind.startsWith("T")) return "total";
  if (kind.startsWith("A")) return "annular";
  if (kind.startsWith("H")) return "hybrid";
  return "partial";
}

function normalizeRecord(raw: any): EclipseRecord {
  return {
    ...raw,
    kind: normalizeKind(String(raw.kind))
  };
}

function parseUtc(iso: string | undefined, label: string): number {
  expect(iso, `${label} should be defined`).toBeDefined();
  const ms = Date.parse(iso as string);
  expect(Number.isFinite(ms), `${label} should be a valid ISO date`).toBe(true);
  return ms;
}

function rootsFromDebug(c: ReturnType<typeof computeCircumstances>): { pen: number[]; umb: number[]; bestT?: number } {
  const debug = (c._debug ?? {}) as { penRoots?: number[]; umbRoots?: number[]; bestT_hours?: number };
  return {
    pen: debug.penRoots ?? [],
    umb: debug.umbRoots ?? [],
    bestT: debug.bestT_hours
  };
}

const catalog = (generatedCatalog as any[]).map(normalizeRecord);

describe("computeCircumstances catalog sweeps", () => {
  it("satisfies invariant checks across every generated eclipse at greatest-point coordinates", () => {
    const counts = { total: 0, annular: 0, partial: 0, none: 0 };

    for (const e of catalog) {
      const observer = { latDeg: e.greatestEclipseLatDeg!, lonDeg: e.greatestEclipseLonDeg! };
      const c = computeCircumstances(e, observer);
      const roots = rootsFromDebug(c);

      counts[c.kindAtLocation]++;
      expect(c.visible, `${e.id} should be visible at its greatest point`).toBe(true);
      expect(roots.pen, `${e.id} should have two penumbral roots`).toHaveLength(2);
      expect(parseUtc(c.maxUtc, `${e.id}.maxUtc`)).toBeTypeOf("number");

      for (const t of roots.pen) {
        expect(Math.abs(fPenumbra(e, observer, t)), `${e.id} pen root should satisfy fPenumbra≈0`).toBeLessThan(1e-6);
      }
      for (const t of roots.umb) {
        expect(Math.abs(fUmbraAbs(e, observer, t)), `${e.id} umb root should satisfy fUmbraAbs≈0`).toBeLessThan(1e-6);
      }

      const c1 = parseUtc(c.c1Utc, `${e.id}.c1Utc`);
      const max = parseUtc(c.maxUtc, `${e.id}.maxUtc`);
      const c4 = parseUtc(c.c4Utc, `${e.id}.c4Utc`);
      expect(c1, `${e.id} C1 should be before max`).toBeLessThan(max);
      expect(max, `${e.id} max should be before C4`).toBeLessThan(c4);

      if (c.kindAtLocation === "total" || c.kindAtLocation === "annular") {
        expect(roots.umb, `${e.id} should have two umbral roots`).toHaveLength(2);
        const c2 = parseUtc(c.c2Utc, `${e.id}.c2Utc`);
        const c3 = parseUtc(c.c3Utc, `${e.id}.c3Utc`);
        expect(c1).toBeLessThan(c2);
        expect(c2).toBeLessThan(max);
        expect(max).toBeLessThan(c3);
        expect(c3).toBeLessThan(c4);
        expect(c.durationSeconds).toBeGreaterThan(0);
        expect(c.magnitude).toBe(1);
      } else {
        expect(roots.umb, `${e.id} partial events should have no umbral roots`).toHaveLength(0);
        expect(c.c2Utc).toBeUndefined();
        expect(c.c3Utc).toBeUndefined();
        expect(c.durationSeconds).toBeUndefined();
        expect(c.magnitude).toBeGreaterThanOrEqual(0);
        expect(c.magnitude).toBeLessThanOrEqual(1);
      }
    }

    expect(counts).toEqual({ total: 142, annular: 131, partial: 181, none: 0 });
  });

  it("keeps non-hybrid greatest-point classification exceptions stable", () => {
    const mismatches: string[] = [];

    for (const e of catalog) {
      if (e.kind === "hybrid") continue;
      const c = computeCircumstances(e, { latDeg: e.greatestEclipseLatDeg!, lonDeg: e.greatestEclipseLonDeg! });
      const expected = e.kind === "total" ? "total" : e.kind === "annular" ? "annular" : "partial";
      if (c.kindAtLocation !== expected) {
        mismatches.push(e.id);
      }
    }

    expect(mismatches).toEqual([
      "1927-01-03T",
      "1927-06-29T",
      "1948-05-09T",
      "1963-01-25T",
      "1966-05-20T",
      "1969-03-18T",
      "1984-05-30T",
      "2002-06-10T",
      "2017-02-26T",
      "2032-05-09T",
      "2035-03-09T",
      "2053-03-20T",
      "2071-03-31T",
      "2085-12-16T",
      "2089-04-10T",
      "2092-02-07T"
    ]);
  });
});

describe("computeCircumstances robustness", () => {
  const base = (sampleCatalog as EclipseRecord[])[0];
  const observer = { latDeg: 0, lonDeg: 0 };

  it("returns a safe non-visible result for malformed polynomial payloads", () => {
    const malformed: EclipseRecord[] = [
      { ...base, x: [], y: [], d: [], mu: [], l1: [], l2: [] },
      { ...base, x: [NaN], y: [NaN], d: [NaN], mu: [NaN], l1: [NaN], l2: [NaN] },
      { ...base, x: [0], y: [0], d: [0], mu: [0], l1: [0], l2: [0] }
    ];

    for (const rec of malformed) {
      const c = computeCircumstances(rec, observer);
      const roots = rootsFromDebug(c);
      expect(c.visible).toBe(false);
      expect(c.kindAtLocation).toBe("none");
      expect(c.c1Utc).toBeUndefined();
      expect(c.c4Utc).toBeUndefined();
      expect(c.maxUtc).toBeDefined();
      expect(roots.pen).toHaveLength(0);
      expect(roots.umb).toHaveLength(0);
    }
  });

  it("throws on an invalid date payload", () => {
    const broken = { ...base, dateYmd: "not-a-date" } as EclipseRecord;
    expect(() => computeCircumstances(broken, observer)).toThrowError(RangeError);
  });

  it("changes computed contacts when observer elevation changes", () => {
    const seaLevel = computeCircumstances(base, { latDeg: 36.1408, lonDeg: -5.3536, elevM: 0 });
    const highAltitude = computeCircumstances(base, { latDeg: 36.1408, lonDeg: -5.3536, elevM: 3000 });

    expect(seaLevel.kindAtLocation).toBe("total");
    expect(highAltitude.kindAtLocation).toBe("total");
    expect(seaLevel.maxUtc).not.toBe(highAltitude.maxUtc);
    expect(seaLevel.c1Utc).not.toBe(highAltitude.c1Utc);
  });
});
