import { describe, expect, it } from "vitest";

import {
  calculatePreviewMoonGeometry,
  determinePreviewTravelDirection,
  PREVIEW_SUN_RADIUS,
} from "../src/utils/previewGeometry";

describe("preview moon geometry", () => {
  it("places C1 at exact outer tangency", () => {
    const geometry = calculatePreviewMoonGeometry({
      progress: 0,
      kindAtLocation: "total",
      contacts: { c1: 0, c2: 0.25, max: 0.5, c3: 0.75, c4: 1 },
    });

    const centerDistance = Math.abs(geometry.moonCenterX - 150);
    expect(centerDistance).toBeCloseTo(PREVIEW_SUN_RADIUS + geometry.moonRadius, 6);
  });

  it("places C2 at exact inner tangency and max at center", () => {
    const c2Geometry = calculatePreviewMoonGeometry({
      progress: 0.25,
      kindAtLocation: "total",
      contacts: { c1: 0, c2: 0.25, max: 0.5, c3: 0.75, c4: 1 },
    });
    const maxGeometry = calculatePreviewMoonGeometry({
      progress: 0.5,
      kindAtLocation: "total",
      contacts: { c1: 0, c2: 0.25, max: 0.5, c3: 0.75, c4: 1 },
    });

    const c2Distance = Math.abs(c2Geometry.moonCenterX - 150);
    expect(c2Distance).toBeCloseTo(Math.abs(PREVIEW_SUN_RADIUS - c2Geometry.moonRadius), 6);
    expect(maxGeometry.moonCenterX).toBeCloseTo(150, 6);
  });

  it("keeps C3 as inner tangency and only exposes sun after C3", () => {
    const c3Geometry = calculatePreviewMoonGeometry({
      progress: 0.75,
      kindAtLocation: "total",
      contacts: { c1: 0, c2: 0.25, max: 0.5, c3: 0.75, c4: 1 },
    });
    const postC3Geometry = calculatePreviewMoonGeometry({
      progress: 0.8,
      kindAtLocation: "total",
      contacts: { c1: 0, c2: 0.25, max: 0.5, c3: 0.75, c4: 1 },
    });

    const c3Distance = Math.abs(c3Geometry.moonCenterX - 150);
    const postC3Distance = Math.abs(postC3Geometry.moonCenterX - 150);

    expect(c3Distance).toBeCloseTo(Math.abs(PREVIEW_SUN_RADIUS - c3Geometry.moonRadius), 6);
    expect(postC3Distance).toBeGreaterThan(c3Distance);
  });

  it("uses contact bearings to keep moon travel direction accurate", () => {
    const leftToRightDirection = determinePreviewTravelDirection({
      c1BearingDeg: 100,
      c4BearingDeg: 140,
    });
    const rightToLeftDirection = determinePreviewTravelDirection({
      c1BearingDeg: 140,
      c4BearingDeg: 100,
    });

    const baseParams = {
      progress: 0.25,
      kindAtLocation: "total" as const,
      contacts: { c1: 0, c2: 0.25, max: 0.5, c3: 0.75, c4: 1 },
    };

    const leftToRight = calculatePreviewMoonGeometry({
      ...baseParams,
      travelDirection: leftToRightDirection,
    });
    const rightToLeft = calculatePreviewMoonGeometry({
      ...baseParams,
      travelDirection: rightToLeftDirection,
    });

    expect(leftToRight.moonOffsetX).toBeLessThan(0);
    expect(rightToLeft.moonOffsetX).toBeGreaterThan(0);
    expect(Math.abs(leftToRight.moonOffsetX)).toBeCloseTo(Math.abs(rightToLeft.moonOffsetX), 6);
  });

  it("falls back to default travel direction when bearings are missing", () => {
    expect(determinePreviewTravelDirection(undefined)).toBe(1);
    expect(determinePreviewTravelDirection({ c2BearingDeg: 120 })).toBe(1);
  });
});
