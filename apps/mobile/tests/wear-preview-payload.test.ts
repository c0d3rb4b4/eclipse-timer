import { describe, expect, it } from "vitest";

import {
  buildPreviewRenderPayloadV1,
  type WearPreviewSourcePayload,
} from "../src/services/wearPreviewPayload";

describe("wear preview payload builder", () => {
  it("builds preview payload using C1/C4 timeline bounds", () => {
    const source: WearPreviewSourcePayload = {
      eclipseId: "2027-08-02T",
      kindAtLocation: "partial",
      magnitude: 0.6,
      c1Utc: "2027-08-02T17:55:00.000Z",
      c4Utc: "2027-08-02T18:05:00.000Z",
      maxUtc: "2027-08-02T18:00:00.000Z",
    };

    const payload = buildPreviewRenderPayloadV1({
      source,
      previewSessionId: "session-1",
      nowMs: Date.parse("2027-08-02T18:00:00.000Z"),
    });

    expect(payload).not.toBeNull();
    expect(payload?.mode).toBe("preview");
    expect(payload?.previewSessionId).toBe("session-1");
    expect(payload?.timelineStartUtc).toBe("2027-08-02T17:55:00.000Z");
    expect(payload?.timelineEndUtc).toBe("2027-08-02T18:05:00.000Z");
    expect(payload?.initialProgress).toBeCloseTo(0.5, 4);
  });

  it("falls back to max-centered timeline bounds when C1/C4 are missing", () => {
    const source: WearPreviewSourcePayload = {
      eclipseId: "2027-08-02T",
      kindAtLocation: "annular",
      maxUtc: "2027-08-02T18:00:00.000Z",
    };

    const payload = buildPreviewRenderPayloadV1({
      source,
      previewSessionId: "session-2",
      nowMs: Date.parse("2027-08-02T18:00:00.000Z"),
    });

    expect(payload).not.toBeNull();
    expect(payload?.timelineStartUtc).toBe("2027-08-02T17:00:00.000Z");
    expect(payload?.timelineEndUtc).toBe("2027-08-02T19:00:00.000Z");
    expect(payload?.initialProgress).toBeCloseTo(0.5, 4);
  });

  it("returns null for invalid source payload", () => {
    const source: WearPreviewSourcePayload = {
      eclipseId: "   ",
      kindAtLocation: "total",
      maxUtc: "2027-08-02T18:00:00.000Z",
    };

    const payload = buildPreviewRenderPayloadV1({
      source,
      previewSessionId: "session-3",
      nowMs: Date.parse("2027-08-02T18:00:00.000Z"),
    });

    expect(payload).toBeNull();
  });
});
