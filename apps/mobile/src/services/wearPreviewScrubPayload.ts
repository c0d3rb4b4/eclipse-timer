export type WearPreviewScrubSource = "phone" | "watch";

export type WearPreviewScrubPayloadV1 = {
  version: 1;
  mode: "preview-scrub";
  previewSessionId: string;
  progress: number;
  source: WearPreviewScrubSource;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function parseWearPreviewScrubPayload(payloadRaw: string): WearPreviewScrubPayloadV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadRaw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (parsed.version !== 1 || parsed.mode !== "preview-scrub") {
    return null;
  }

  if (typeof parsed.previewSessionId !== "string" || parsed.previewSessionId.trim().length === 0) {
    return null;
  }

  if (typeof parsed.progress !== "number" || !Number.isFinite(parsed.progress)) {
    return null;
  }

  if (parsed.source !== "phone" && parsed.source !== "watch") {
    return null;
  }

  return {
    version: 1,
    mode: "preview-scrub",
    previewSessionId: parsed.previewSessionId.trim(),
    progress: clamp01(parsed.progress),
    source: parsed.source,
  };
}

export function createWearPreviewScrubPayload(params: {
  previewSessionId: string;
  progress: number;
  source: WearPreviewScrubSource;
}): WearPreviewScrubPayloadV1 | null {
  const previewSessionId = params.previewSessionId.trim();
  if (!previewSessionId) {
    return null;
  }

  return {
    version: 1,
    mode: "preview-scrub",
    previewSessionId,
    progress: clamp01(params.progress),
    source: params.source,
  };
}
