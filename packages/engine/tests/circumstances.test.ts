import { describe, expect, it } from "vitest";
import type { Circumstances, EclipseKind, EclipseRecord } from "@eclipse-timer/shared";
import sampleCatalog from "../../catalog/src/catalog.sample.json";
import generatedCatalog from "../../catalog/generated/catalog.generated.json";
import { computeCircumstances } from "../src/circumstances/compute";
import { evaluateAtT, fPenumbra, fUmbraAbs } from "../src/circumstances/functions";

const gibraltar = { latDeg: 36.1408, lonDeg: -5.3536 };
const centralAt1000 = { latDeg: 26 + 53.3 / 60, lonDeg: 31 + 0.8 / 60 };
const sampleRecord = (sampleCatalog as EclipseRecord[])[0];

function requireDefined<T>(value: T | undefined, label: string): T {
  expect(value, `${label} should be defined`).toBeDefined();
  return value as T;
}

function parseUtc(iso: string | undefined, label: string): number {
  const value = requireDefined(iso, label);
  const ms = Date.parse(value);
  expect(Number.isFinite(ms), `${label} should be a valid ISO date`).toBe(true);
  return ms;
}

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

const generatedById = new Map(
  (generatedCatalog as any[]).map((raw) => [raw.id as string, normalizeRecord(raw)])
);

function getRecord(id: string): EclipseRecord {
  return requireDefined(generatedById.get(id), id);
}

function getGreatestObserver(e: EclipseRecord): { latDeg: number; lonDeg: number } {
  return {
    latDeg: requireDefined(e.greatestEclipseLatDeg, `${e.id}.greatestEclipseLatDeg`),
    lonDeg: requireDefined(e.greatestEclipseLonDeg, `${e.id}.greatestEclipseLonDeg`)
  };
}

function expectOrderedContacts(c: Circumstances): void {
  const c1 = parseUtc(c.c1Utc, "c1Utc");
  const max = parseUtc(c.maxUtc, "maxUtc");
  const c4 = parseUtc(c.c4Utc, "c4Utc");
  expect(c1).toBeLessThan(max);
  expect(max).toBeLessThan(c4);

  if (c.kindAtLocation === "total" || c.kindAtLocation === "annular") {
    const c2 = parseUtc(c.c2Utc, "c2Utc");
    const c3 = parseUtc(c.c3Utc, "c3Utc");
    expect(c1).toBeLessThan(c2);
    expect(c2).toBeLessThan(max);
    expect(max).toBeLessThan(c3);
    expect(c3).toBeLessThan(c4);
    const expectedDuration = (c3 - c2) / 1000;
    expect(c.durationSeconds).toBeCloseTo(expectedDuration, 2);
    expect(c.magnitude).toBe(1);
  } else {
    expect(c.c2Utc).toBeUndefined();
    expect(c.c3Utc).toBeUndefined();
    expect(c.durationSeconds).toBeUndefined();
    const magnitude = requireDefined(c.magnitude, "partial magnitude");
    expect(magnitude).toBeGreaterThanOrEqual(0);
    expect(magnitude).toBeLessThanOrEqual(1);
  }
}

function expectRootsNearZero(e: EclipseRecord, observer: { latDeg: number; lonDeg: number }, c: Circumstances): void {
  const debug = (c._debug ?? {}) as {
    penRoots?: number[];
    umbRoots?: number[];
    bestT_hours?: number;
  };
  const penRoots = debug.penRoots ?? [];
  const umbRoots = debug.umbRoots ?? [];

  for (const t of penRoots) {
    expect(Math.abs(fPenumbra(e, observer, t))).toBeLessThan(1e-6);
  }
  for (const t of umbRoots) {
    expect(Math.abs(fUmbraAbs(e, observer, t))).toBeLessThan(1e-6);
  }

  if ((c.kindAtLocation === "total" || c.kindAtLocation === "annular") && umbRoots.length >= 2) {
    const bestT = requireDefined(debug.bestT_hours, "bestT_hours");
    expect(bestT).toBeGreaterThan(umbRoots[0]!);
    expect(bestT).toBeLessThan(umbRoots[umbRoots.length - 1]!);
  }
}

describe("evaluateAtT", () => {
  it("evaluates projected geometry for a known sample at t=0", () => {
    const v = evaluateAtT(sampleRecord, gibraltar, 0);

    expect(v.x).toBeCloseTo(-0.019645, 12);
    expect(v.y).toBeCloseTo(0.160063, 12);
    expect(v.delta).toBeCloseTo(0.5077677818358982, 12);
    expect(v.L1obs).toBeCloseTo(0.5269366371706478, 12);
    expect(v.L2obs).toBeCloseTo(-0.019105091436274025, 12);
    expect(v.xi).toBeCloseTo(-0.48579793359042617, 12);
    expect(v.eta).toBeCloseTo(0.3613825538828459, 12);
    expect(v.zeta).toBeCloseTo(0.7944083947013187, 12);
  });

  it("keeps fPenumbra and fUmbraAbs consistent with evaluateAtT", () => {
    for (const t of [-1.25, 0, 0.5]) {
      const v = evaluateAtT(sampleRecord, gibraltar, t);
      expect(fPenumbra(sampleRecord, gibraltar, t)).toBeCloseTo(v.delta - v.L1obs, 12);
      expect(fUmbraAbs(sampleRecord, gibraltar, t)).toBeCloseTo(v.delta - Math.abs(v.L2obs), 12);
    }
  });
});

describe("computeCircumstances", () => {
  it("returns a deterministic total-eclipse solution for the sample record", () => {
    const c = computeCircumstances(sampleRecord, gibraltar);

    expect(c.eclipseId).toBe("2027-08-02T");
    expect(c.visible).toBe(true);
    expect(c.kindAtLocation).toBe("total");
    expect(c.c1Utc).toBe("2027-08-02T07:41:16.356Z");
    expect(c.c2Utc).toBe("2027-08-02T08:45:51.154Z");
    expect(c.maxUtc).toBe("2027-08-02T08:48:03.154Z");
    expect(c.c3Utc).toBe("2027-08-02T08:50:20.221Z");
    expect(c.c4Utc).toBe("2027-08-02T10:01:35.361Z");
    expect(c.durationSeconds).toBeCloseTo(269.06730651855105, 9);
    expect(c.magnitude).toBe(1);

    expectOrderedContacts(c);
    expectRootsNearZero(sampleRecord, gibraltar, c);
  });

  it("returns a deterministic central-line scenario for the sample record", () => {
    const c = computeCircumstances(sampleRecord, centralAt1000);

    expect(c.eclipseId).toBe("2027-08-02T");
    expect(c.visible).toBe(true);
    expect(c.kindAtLocation).toBe("total");
    expect(c.c1Utc).toBe("2027-08-02T08:36:02.381Z");
    expect(c.c2Utc).toBe("2027-08-02T09:57:27.183Z");
    expect(c.maxUtc).toBe("2027-08-02T10:00:39.183Z");
    expect(c.c3Utc).toBe("2027-08-02T10:03:46.662Z");
    expect(c.c4Utc).toBe("2027-08-02T11:22:11.009Z");
    expect(c.durationSeconds).toBeCloseTo(379.4789886474608, 9);
    expect(c.magnitude).toBe(1);

    expectOrderedContacts(c);
    expectRootsNearZero(sampleRecord, centralAt1000, c);
  });

  it("classifies a greatest-eclipse point as total for a known total eclipse", () => {
    const total = getRecord("1900-05-28T");
    const c = computeCircumstances(total, getGreatestObserver(total));

    expect(c.visible).toBe(true);
    expect(c.kindAtLocation).toBe("total");
    expect(c.maxUtc).toBe("1900-05-28T14:53:57.946Z");
    expect(c.durationSeconds).toBeCloseTo(129.50637817382815, 9);
    expectOrderedContacts(c);
  });

  it("classifies a greatest-eclipse point as annular for a known annular eclipse", () => {
    const annular = getRecord("1900-11-22T");
    const c = computeCircumstances(annular, getGreatestObserver(annular));

    expect(c.visible).toBe(true);
    expect(c.kindAtLocation).toBe("annular");
    expect(c.maxUtc).toBe("1900-11-22T07:19:46.155Z");
    expect(c.durationSeconds).toBeCloseTo(402.30537414550747, 9);
    expectOrderedContacts(c);
  });

  it("matches additional regression vectors for partial and hybrid records", () => {
    const partial = getRecord("1902-05-07T");
    const partialCirc = computeCircumstances(partial, getGreatestObserver(partial));
    expect(partialCirc.kindAtLocation).toBe("partial");
    expect(partialCirc.c1Utc).toBe("1902-05-07T21:31:15.722Z");
    expect(partialCirc.maxUtc).toBe("1902-05-07T22:34:21.722Z");
    expect(partialCirc.c4Utc).toBe("1902-05-07T23:36:01.725Z");
    expect(partialCirc.magnitude).toBeCloseTo(0.8386949130935953, 12);
    expectOrderedContacts(partialCirc);

    const hybrid = getRecord("1908-12-23T");
    const hybridCirc = computeCircumstances(hybrid, getGreatestObserver(hybrid));
    expect(hybridCirc.kindAtLocation).toBe("partial");
    expect(hybridCirc.c1Utc).toBe("1908-12-23T10:24:24.654Z");
    expect(hybridCirc.maxUtc).toBe("1908-12-23T11:44:24.654Z");
    expect(hybridCirc.c4Utc).toBe("1908-12-23T13:05:35.186Z");
    expect(hybridCirc.magnitude).toBeCloseTo(0.9994543016681365, 12);
    expectOrderedContacts(hybridCirc);
  });

  it("keeps contact invariants across mixed eclipse kinds at greatest points", () => {
    const ids = ["1900-05-28T", "1900-11-22T", "1902-05-07T", "1908-12-23T", "1919-05-29T", "2027-08-02T"];
    for (const id of ids) {
      const e = getRecord(id);
      const c = computeCircumstances(e, getGreatestObserver(e));

      expect(c.visible).toBe(true);
      expect(Number.isFinite(parseUtc(c.maxUtc, `${id}.maxUtc`))).toBe(true);
      expectOrderedContacts(c);
      expectRootsNearZero(e, getGreatestObserver(e), c);
    }
  });

  it("returns none when observer is outside eclipse visibility", () => {
    const total = getRecord("1900-05-28T");
    const c = computeCircumstances(total, { latDeg: -80, lonDeg: 120 });
    const debug = (c._debug ?? {}) as { penRoots?: number[]; umbRoots?: number[] };

    expect(c.visible).toBe(false);
    expect(c.kindAtLocation).toBe("none");
    expect(c.c1Utc).toBeUndefined();
    expect(c.c2Utc).toBeUndefined();
    expect(c.c3Utc).toBeUndefined();
    expect(c.c4Utc).toBeUndefined();
    expect(c.durationSeconds).toBeUndefined();
    expect(c.magnitude).toBeUndefined();
    expect(c.maxUtc).toBe("1900-05-28T14:54:02.200Z");
    expect(debug.penRoots ?? []).toHaveLength(0);
    expect(debug.umbRoots ?? []).toHaveLength(0);
  });
});
