import { describe, expect, it } from "vitest";

import {
  calculatePreviewMoonGeometry,
  describePreviewTravelDirection,
  determinePreviewTravelVector,
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

  it("uses contact bearings to produce a diagonal moon travel vector", () => {
    const travelVector = determinePreviewTravelVector({
      c1BearingDeg: 246,
      c4BearingDeg: 66,
    });

    expect(travelVector.x).toBeGreaterThan(0);
    expect(travelVector.y).toBeLessThan(0);

    const baseParams = {
      progress: 0.25,
      kindAtLocation: "total" as const,
      contacts: { c1: 0, c2: 0.25, max: 0.5, c3: 0.75, c4: 1 },
    };

    const earlyGeometry = calculatePreviewMoonGeometry({
      ...baseParams,
      travelVector,
    });
    const lateGeometry = calculatePreviewMoonGeometry({
      ...baseParams,
      progress: 0.75,
      travelVector,
    });

    expect(lateGeometry.moonCenterX).toBeGreaterThan(earlyGeometry.moonCenterX);
    expect(lateGeometry.moonCenterY).toBeLessThan(earlyGeometry.moonCenterY);
  });

  it("falls back to default travel vector when bearings are missing", () => {
    expect(determinePreviewTravelVector(undefined)).toEqual({ x: 1, y: 0 });
    expect(determinePreviewTravelVector({ c2BearingDeg: 120 })).toEqual({ x: 1, y: 0 });
  });

  it("describes moon travel direction in user-facing terms", () => {
    expect(describePreviewTravelDirection({ x: 0.8, y: -0.4 })).toBe(
      "bottom to top, left to right",
    );
    expect(describePreviewTravelDirection({ x: -0.7, y: 0.1 })).toBe("right to left");
  });

  it("keeps C1 and C4 as tangency even with non-zero closest approach", () => {
    const travelVector = determinePreviewTravelVector({
      c1BearingDeg: 230,
      c4BearingDeg: 30,
    });

    const c1Geometry = calculatePreviewMoonGeometry({
      progress: 0,
      kindAtLocation: "partial",
      magnitude: 0.72,
      contacts: { c1: 0, max: 0.5, c4: 1 },
      travelVector,
    });
    const c4Geometry = calculatePreviewMoonGeometry({
      progress: 1,
      kindAtLocation: "partial",
      magnitude: 0.72,
      contacts: { c1: 0, max: 0.5, c4: 1 },
      travelVector,
    });

    const stageCenter = 150;
    const c1Distance = Math.hypot(
      c1Geometry.moonCenterX - stageCenter,
      c1Geometry.moonCenterY - stageCenter,
    );
    const c4Distance = Math.hypot(
      c4Geometry.moonCenterX - stageCenter,
      c4Geometry.moonCenterY - stageCenter,
    );

    expect(c1Distance).toBeCloseTo(PREVIEW_SUN_RADIUS + c1Geometry.moonRadius, 6);
    expect(c4Distance).toBeCloseTo(PREVIEW_SUN_RADIUS + c4Geometry.moonRadius, 6);
  });
});
