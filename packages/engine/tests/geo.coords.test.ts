import { describe, expect, it } from "vitest";
import { observerToFundamental } from "../src/geo/coords";

describe("observerToFundamental", () => {
  it("matches fixed regression vectors for representative locations", () => {
    const cases = [
      {
        name: "equator-zero",
        args: [0, 0, 0, 0, 0] as const,
        expected: { xi: 0, eta: 0, zeta: 1 }
      },
      {
        name: "gibraltar-2027-like",
        args: [36.1408, -5.3536, 17.76247, 328.42249, 0] as const,
        expected: {
          xi: -0.48579793359042617,
          eta: 0.3613825538828459,
          zeta: 0.7944083947013187
        }
      },
      {
        name: "nyc-high",
        args: [40.7128, -74.006, 15.2, 120.5, 1500] as const,
        expected: {
          xi: 0.5506847731182407,
          eta: 0.48923204403116244,
          zeta: 0.6745597600676998
        }
      },
      {
        name: "south-high-alt",
        args: [-33.8688, 151.2093, -20.0, 288.4, 2500] as const,
        expected: {
          xi: 0.8178697748732772,
          eta: -0.46963253793839027,
          zeta: 0.330526975986294
        }
      },
      {
        name: "near-north-pole",
        args: [89.9, 45, 5.5, 10.2, 100] as const,
        expected: {
          xi: 0.0014380187921485708,
          eta: 0.9919771156066424,
          zeta: 0.09652060393880085
        }
      }
    ];

    for (const tc of cases) {
      const v = observerToFundamental(...tc.args);
      expect(v.xi, `${tc.name}.xi`).toBeCloseTo(tc.expected.xi, 12);
      expect(v.eta, `${tc.name}.eta`).toBeCloseTo(tc.expected.eta, 12);
      expect(v.zeta, `${tc.name}.zeta`).toBeCloseTo(tc.expected.zeta, 12);
    }
  });

  it("is periodic in longitude and mu by 360 degrees", () => {
    const base = observerToFundamental(36.1408, -5.3536, 17.76247, 328.42249, 0);
    const lonShift = observerToFundamental(36.1408, -5.3536 + 360, 17.76247, 328.42249, 0);
    const muShift = observerToFundamental(36.1408, -5.3536, 17.76247, 328.42249 + 360, 0);

    for (const v of [lonShift, muShift]) {
      expect(v.xi).toBeCloseTo(base.xi, 12);
      expect(v.eta).toBeCloseTo(base.eta, 12);
      expect(v.zeta).toBeCloseTo(base.zeta, 12);
    }
  });

  it("reacts to elevation changes and remains finite near extremes", () => {
    const seaLevel = observerToFundamental(36.1408, -5.3536, 17.76247, 328.42249, 0);
    const mountain = observerToFundamental(36.1408, -5.3536, 17.76247, 328.42249, 3000);

    expect(mountain.xi).not.toBe(seaLevel.xi);
    expect(mountain.eta).not.toBe(seaLevel.eta);
    expect(mountain.zeta).not.toBe(seaLevel.zeta);

    const nearSouthPole = observerToFundamental(-89.9, -120, -5, 250, 50);
    expect(Number.isFinite(nearSouthPole.xi)).toBe(true);
    expect(Number.isFinite(nearSouthPole.eta)).toBe(true);
    expect(Number.isFinite(nearSouthPole.zeta)).toBe(true);
  });
});
