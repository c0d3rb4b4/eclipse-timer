import type { Circumstances } from "@eclipse-timer/shared";
import { describe, expect, it } from "vitest";

import {
  buildLiveRenderPayloadFromLocation,
  isCircumstancesActiveNow,
  parseWearLiveLocationPayload,
} from "../src/services/wearLiveCompute";

describe("wear live compute", () => {
  it("parses a valid live-location payload", () => {
    const parsed = parseWearLiveLocationPayload(
      JSON.stringify({
        type: "live-location",
        latitudeDeg: 32.7767,
        longitudeDeg: -96.797,
        capturedAtUtc: "2027-08-02T18:00:00.000Z",
        accuracyMeters: 12.5,
      }),
    );

    expect(parsed).toEqual({
      latitudeDeg: 32.7767,
      longitudeDeg: -96.797,
      capturedAtUtc: "2027-08-02T18:00:00.000Z",
      accuracyMeters: 12.5,
    });
  });

  it("rejects non live-location message payloads", () => {
    const parsed = parseWearLiveLocationPayload(
      JSON.stringify({
        type: "phase0-test",
        source: "wear",
      }),
    );

    expect(parsed).toBeNull();
  });

  it("returns sun-only payload when no active eclipse circumstances exist", () => {
    const nowMs = Date.parse("2027-08-02T18:00:00.000Z");
    const payload = buildLiveRenderPayloadFromLocation(
      {
        latitudeDeg: 32.7767,
        longitudeDeg: -96.797,
      },
      {
        nowMs,
        findActiveCircumstances: () => null,
      },
    );

    expect(payload.mode).toBe("live");
    expect(payload.generatedAtUtc).toBe("2027-08-02T18:00:00.000Z");
    expect(payload.showMoon).toBe(false);
  });

  it("builds a moon-render payload when active circumstances are provided", () => {
    const nowMs = Date.parse("2027-08-02T18:00:00.000Z");
    const c1Utc = "2027-08-02T17:55:00.000Z";
    const c2Utc = "2027-08-02T17:58:00.000Z";
    const maxUtc = "2027-08-02T18:00:00.000Z";
    const c3Utc = "2027-08-02T18:02:00.000Z";
    const c4Utc = "2027-08-02T18:05:00.000Z";

    const activeCircumstances: Circumstances = {
      eclipseId: "2027-08-02T",
      visible: true,
      kindAtLocation: "partial",
      magnitude: 0.72,
      c1Utc,
      c2Utc,
      maxUtc,
      c3Utc,
      c4Utc,
      c1BearingDeg: 90,
      c2BearingDeg: 95,
      c3BearingDeg: 265,
      c4BearingDeg: 270,
    };

    const payload = buildLiveRenderPayloadFromLocation(
      {
        latitudeDeg: 32.7767,
        longitudeDeg: -96.797,
      },
      {
        nowMs,
        findActiveCircumstances: () => activeCircumstances,
      },
    );

    expect(payload.showMoon).toBe(true);
    if (!payload.showMoon) {
      throw new Error("Expected moon payload in active circumstances test.");
    }

    expect(payload.moon.radiusNorm).toBeGreaterThanOrEqual(0);
    expect(payload.moon.radiusNorm).toBeLessThanOrEqual(1);
    expect(payload.moon.centerXNorm).toBeGreaterThanOrEqual(0);
    expect(payload.moon.centerXNorm).toBeLessThanOrEqual(1);
    expect(payload.moon.centerYNorm).toBeGreaterThanOrEqual(0);
    expect(payload.moon.centerYNorm).toBeLessThanOrEqual(1);
  });

  it("correctly identifies whether circumstances are active at a timestamp", () => {
    const circumstances: Circumstances = {
      eclipseId: "test",
      visible: true,
      kindAtLocation: "partial",
      c1Utc: "2027-08-02T17:55:00.000Z",
      c4Utc: "2027-08-02T18:05:00.000Z",
    };

    expect(isCircumstancesActiveNow(circumstances, Date.parse("2027-08-02T18:00:00.000Z"))).toBe(
      true,
    );
    expect(isCircumstancesActiveNow(circumstances, Date.parse("2027-08-02T18:30:00.000Z"))).toBe(
      false,
    );
  });
});
