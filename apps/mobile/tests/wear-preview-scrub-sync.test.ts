import { describe, expect, it } from "vitest";

import { parseWearPreviewScrubPayload } from "../src/services/wearPreviewScrubPayload";

describe("wear preview scrub sync payload parsing", () => {
  it("parses a valid preview scrub payload", () => {
    const parsed = parseWearPreviewScrubPayload(
      JSON.stringify({
        version: 1,
        mode: "preview-scrub",
        previewSessionId: "session-123",
        progress: 0.42,
        source: "watch",
      }),
    );

    expect(parsed).toEqual({
      version: 1,
      mode: "preview-scrub",
      previewSessionId: "session-123",
      progress: 0.42,
      source: "watch",
    });
  });

  it("clamps progress into [0, 1]", () => {
    const parsed = parseWearPreviewScrubPayload(
      JSON.stringify({
        version: 1,
        mode: "preview-scrub",
        previewSessionId: "session-abc",
        progress: 2.4,
        source: "phone",
      }),
    );

    expect(parsed?.progress).toBe(1);
  });

  it("rejects invalid preview scrub payloads", () => {
    expect(
      parseWearPreviewScrubPayload(
        JSON.stringify({
          version: 1,
          mode: "preview",
          previewSessionId: "session-xyz",
          progress: 0.5,
          source: "watch",
        }),
      ),
    ).toBeNull();

    expect(
      parseWearPreviewScrubPayload(
        JSON.stringify({
          version: 1,
          mode: "preview-scrub",
          previewSessionId: "   ",
          progress: 0.5,
          source: "watch",
        }),
      ),
    ).toBeNull();
  });
});
