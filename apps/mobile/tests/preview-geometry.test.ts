import { describe, expect, it } from "vitest";

import { calculatePreviewMoonGeometry, PREVIEW_SUN_RADIUS } from "../src/utils/previewGeometry";

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
});
