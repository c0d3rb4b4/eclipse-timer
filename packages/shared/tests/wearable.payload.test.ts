import { describe, expect, it } from "vitest";
import {
  sanitizeLiveRenderPayloadV1,
  sanitizePreviewRenderPayloadV1,
  sanitizeWearRenderPayloadV1,
} from "../src/wearable";

describe("sanitizeWearRenderPayloadV1", () => {
  it("discriminates live and preview payload modes", () => {
    const live = sanitizeWearRenderPayloadV1({
      version: 1,
      mode: "live",
      generatedAtUtc: "2026-08-12T10:00:00Z",
      watchLatDeg: 40.7128,
      watchLonDeg: -74.006,
      showMoon: false,
    });

    const preview = sanitizeWearRenderPayloadV1({
      version: 1,
      mode: "preview",
      previewSessionId: "session-1",
      eclipseId: "eclipse-2026",
      timelineStartUtc: "2026-08-12T09:00:00Z",
      timelineEndUtc: "2026-08-12T11:00:00Z",
      initialProgress: 0.25,
      visual: {
        sunRadiusNorm: 0.45,
        moonRadiusNorm: 0.44,
        moonClosestOffsetNorm: 0.05,
        moonTravelHalfSpanNorm: 0.5,
      },
    });

    expect(live?.mode).toBe("live");
    expect(preview?.mode).toBe("preview");
  });

  it("clamps normalized values into [0,1]", () => {
    const live = sanitizeLiveRenderPayloadV1({
      version: 1,
      mode: "live",
      generatedAtUtc: "2026-08-12T10:00:00Z",
      watchLatDeg: 0,
      watchLonDeg: 0,
      showMoon: true,
      moon: {
        radiusNorm: 3,
        centerXNorm: -2,
        centerYNorm: 0.4,
      },
    });

    const preview = sanitizePreviewRenderPayloadV1({
      version: 1,
      mode: "preview",
      previewSessionId: "session-2",
      eclipseId: "eclipse-2027",
      timelineStartUtc: "2027-08-02T08:00:00Z",
      timelineEndUtc: "2027-08-02T12:00:00Z",
      initialProgress: 100,
      visual: {
        sunRadiusNorm: 2,
        moonRadiusNorm: -0.1,
        moonClosestOffsetNorm: 0.2,
        moonTravelHalfSpanNorm: 42,
      },
    });

    expect(live?.moon?.radiusNorm).toBe(1);
    expect(live?.moon?.centerXNorm).toBe(0);
    expect(live?.moon?.centerYNorm).toBe(0.4);
    expect(preview?.initialProgress).toBe(1);
    expect(preview?.visual.sunRadiusNorm).toBe(1);
    expect(preview?.visual.moonRadiusNorm).toBe(0);
    expect(preview?.visual.moonTravelHalfSpanNorm).toBe(1);
  });

  it("rejects invalid payloads", () => {
    expect(
      sanitizeWearRenderPayloadV1({
        version: 1,
        mode: "live",
        generatedAtUtc: "2026-08-12T10:00:00Z",
        watchLatDeg: 95,
        watchLonDeg: 0,
        showMoon: false,
      }),
    ).toBeNull();

    expect(
      sanitizeWearRenderPayloadV1({
        version: 1,
        mode: "preview",
        previewSessionId: "session-3",
        eclipseId: "eclipse-2028",
        timelineStartUtc: "2028-01-26T08:00:00Z",
        timelineEndUtc: "2028-01-26T10:00:00Z",
        initialProgress: 0.5,
      }),
    ).toBeNull();

    expect(sanitizeWearRenderPayloadV1({ version: 99, mode: "live" })).toBeNull();
  });
});
