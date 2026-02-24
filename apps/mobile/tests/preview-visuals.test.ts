import { describe, expect, it } from "vitest";

import { calculateTotalityGlowBlend } from "../src/utils/previewVisuals";

describe("preview totality glow blend", () => {
  const c2Iso = "2027-08-02T18:00:00.000Z";
  const c3Iso = "2027-08-02T18:03:00.000Z";
  const c2Ms = Date.parse(c2Iso);
  const c3Ms = Date.parse(c3Iso);

  it("returns zero for non-total eclipses", () => {
    expect(
      calculateTotalityGlowBlend({
        kindAtLocation: "partial",
        currentMs: c2Ms + 30_000,
        c2Utc: c2Iso,
        c3Utc: c3Iso,
      }),
    ).toBe(0);
  });

  it("ramps in near C2 and reaches high blend during totality", () => {
    const farBefore = calculateTotalityGlowBlend({
      kindAtLocation: "total",
      currentMs: c2Ms - 40_000,
      c2Utc: c2Iso,
      c3Utc: c3Iso,
    });
    const nearC2 = calculateTotalityGlowBlend({
      kindAtLocation: "total",
      currentMs: c2Ms - 2_000,
      c2Utc: c2Iso,
      c3Utc: c3Iso,
    });
    const midTotality = calculateTotalityGlowBlend({
      kindAtLocation: "total",
      currentMs: c2Ms + 45_000,
      c2Utc: c2Iso,
      c3Utc: c3Iso,
    });

    expect(nearC2).toBeGreaterThan(farBefore);
    expect(midTotality).toBeGreaterThan(0.9);
  });

  it("ramps out after C3 back toward partial visuals", () => {
    const nearC3 = calculateTotalityGlowBlend({
      kindAtLocation: "total",
      currentMs: c3Ms - 2_000,
      c2Utc: c2Iso,
      c3Utc: c3Iso,
    });
    const shortlyAfterC3 = calculateTotalityGlowBlend({
      kindAtLocation: "total",
      currentMs: c3Ms + 20_000,
      c2Utc: c2Iso,
      c3Utc: c3Iso,
    });
    const farAfterC3 = calculateTotalityGlowBlend({
      kindAtLocation: "total",
      currentMs: c3Ms + 120_000,
      c2Utc: c2Iso,
      c3Utc: c3Iso,
    });

    expect(shortlyAfterC3).toBeLessThan(nearC3);
    expect(farAfterC3).toBe(0);
  });

  it("returns zero when totality contacts are missing", () => {
    expect(
      calculateTotalityGlowBlend({
        kindAtLocation: "total",
        currentMs: c2Ms,
        c2Utc: c2Iso,
      }),
    ).toBe(0);
    expect(
      calculateTotalityGlowBlend({
        kindAtLocation: "total",
        currentMs: c2Ms,
        c3Utc: c3Iso,
      }),
    ).toBe(0);
  });
});
