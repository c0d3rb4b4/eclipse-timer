import { describe, expect, it } from "vitest";
import type { EclipseKind, EclipseRecord } from "@eclipse-timer/shared";
import sampleCatalog from "../../catalog/src/catalog.sample.json";
import generatedCatalog from "../../catalog/generated/catalog.generated.json";
import { computeCircumstances } from "../src/circumstances/compute";
import { evaluateAtT, fPenumbra, fUmbraAbs } from "../src/circumstances/functions";

const gibraltar = { latDeg: 36.1408, lonDeg: -5.3536 };
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

    const c1 = parseUtc(c.c1Utc, "c1Utc");
    const c2 = parseUtc(c.c2Utc, "c2Utc");
    const max = parseUtc(c.maxUtc, "maxUtc");
    const c3 = parseUtc(c.c3Utc, "c3Utc");
    const c4 = parseUtc(c.c4Utc, "c4Utc");
    expect(c1).toBeLessThan(c2);
    expect(c2).toBeLessThan(max);
    expect(max).toBeLessThan(c3);
    expect(c3).toBeLessThan(c4);
  });

  it("classifies a greatest-eclipse point as total for a known total eclipse", () => {
    const total = requireDefined(generatedById.get("1900-05-28T"), "1900-05-28T");
    const obs = {
      latDeg: requireDefined(total.greatestEclipseLatDeg, "greatestEclipseLatDeg"),
      lonDeg: requireDefined(total.greatestEclipseLonDeg, "greatestEclipseLonDeg")
    };

    const c = computeCircumstances(total, obs);

    expect(c.visible).toBe(true);
    expect(c.kindAtLocation).toBe("total");
    expect(c.maxUtc).toBe("1900-05-28T14:53:57.946Z");
    expect(c.durationSeconds).toBeCloseTo(129.50637817382815, 9);
  });

  it("classifies a greatest-eclipse point as annular for a known annular eclipse", () => {
    const annular = requireDefined(generatedById.get("1900-11-22T"), "1900-11-22T");
    const obs = {
      latDeg: requireDefined(annular.greatestEclipseLatDeg, "greatestEclipseLatDeg"),
      lonDeg: requireDefined(annular.greatestEclipseLonDeg, "greatestEclipseLonDeg")
    };

    const c = computeCircumstances(annular, obs);

    expect(c.visible).toBe(true);
    expect(c.kindAtLocation).toBe("annular");
    expect(c.maxUtc).toBe("1900-11-22T07:19:46.155Z");
    expect(c.durationSeconds).toBeCloseTo(402.30537414550747, 9);
  });

  it("returns none when observer is outside eclipse visibility", () => {
    const total = requireDefined(generatedById.get("1900-05-28T"), "1900-05-28T");
    const c = computeCircumstances(total, { latDeg: -80, lonDeg: 120 });

    expect(c.visible).toBe(false);
    expect(c.kindAtLocation).toBe("none");
    expect(c.c1Utc).toBeUndefined();
    expect(c.c2Utc).toBeUndefined();
    expect(c.c3Utc).toBeUndefined();
    expect(c.c4Utc).toBeUndefined();
    expect(c.durationSeconds).toBeUndefined();
    expect(c.magnitude).toBeUndefined();
    expect(c.maxUtc).toBe("1900-05-28T14:54:02.200Z");
  });
});
