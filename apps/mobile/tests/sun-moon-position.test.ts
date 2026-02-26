import { describe, expect, it } from "vitest";

import { calculateSunMoonHorizontalPosition } from "../src/utils/sunMoonPosition";

const GIBRALTAR_OBSERVER = {
  latitudeDeg: 36.13173,
  longitudeDeg: -5.34095,
};

const STELLARIUM_REFERENCE = [
  {
    isoLocal: "2027-08-02T08:39:01+01:00",
    sunAzimuthDeg: 85.285,
    sunAltitudeDeg: 24.592,
    moonAzimuthDeg: 85.438,
    moonAltitudeDeg: 25.134,
  },
  {
    isoLocal: "2027-08-02T09:13:30+01:00",
    sunAzimuthDeg: 90.235,
    sunAltitudeDeg: 31.534,
    moonAzimuthDeg: 90.313,
    moonAltitudeDeg: 31.798,
  },
  {
    isoLocal: "2027-08-02T09:48:00+01:00",
    sunAzimuthDeg: 95.582,
    sunAltitudeDeg: 38.479,
    moonAzimuthDeg: 95.59,
    moonAltitudeDeg: 38.475,
  },
  {
    isoLocal: "2027-08-02T10:25:55+01:00",
    sunAzimuthDeg: 102.267,
    sunAltitudeDeg: 46.031,
    moonAzimuthDeg: 102.188,
    moonAltitudeDeg: 45.746,
  },
  {
    isoLocal: "2027-08-02T11:03:51+01:00",
    sunAzimuthDeg: 110.42,
    sunAltitudeDeg: 53.374,
    moonAzimuthDeg: 110.194,
    moonAltitudeDeg: 52.825,
  },
] as const;

describe("sun/moon horizontal position", () => {
  it("tracks Stellarium reference az/alt samples for 2027-08-02 Gibraltar", () => {
    for (const sample of STELLARIUM_REFERENCE) {
      const epochMs = Date.parse(sample.isoLocal);
      expect(Number.isFinite(epochMs)).toBe(true);

      const computed = calculateSunMoonHorizontalPosition({
        ...GIBRALTAR_OBSERVER,
        epochMs,
      });

      expect(computed.sun.azimuthDeg).toBeCloseTo(sample.sunAzimuthDeg, 0);
      expect(computed.sun.altitudeDeg).toBeCloseTo(sample.sunAltitudeDeg, 0);
      expect(computed.moon.azimuthDeg).toBeCloseTo(sample.moonAzimuthDeg, 0);
      expect(computed.moon.altitudeDeg).toBeCloseTo(sample.moonAltitudeDeg, 0);
    }
  });

  it("returns realistic angular sizes for 24mm framing", () => {
    const epochMs = Date.parse("2027-08-02T09:48:00+01:00");
    const computed = calculateSunMoonHorizontalPosition({
      ...GIBRALTAR_OBSERVER,
      epochMs,
    });

    expect(computed.sun.angularRadiusDeg).toBeGreaterThan(0.24);
    expect(computed.sun.angularRadiusDeg).toBeLessThan(0.28);
    expect(computed.moon.angularRadiusDeg).toBeGreaterThan(0.24);
    expect(computed.moon.angularRadiusDeg).toBeLessThan(0.32);
  });
});
