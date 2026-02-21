export type WearMode = "live" | "preview";

export type LiveMoonGeometryV1 = {
  radiusNorm: number;
  centerXNorm: number;
  centerYNorm: number;
};

export type LiveRenderPayloadV1 = {
  version: 1;
  mode: "live";
  generatedAtUtc: string;
  watchLatDeg: number;
  watchLonDeg: number;
} & (
  | {
      showMoon: false;
    }
  | {
      showMoon: true;
      moon: LiveMoonGeometryV1;
    }
);

export type PreviewVisualV1 = {
  sunRadiusNorm: number;
  moonRadiusNorm: number;
  moonClosestOffsetNorm: number;
  moonTravelHalfSpanNorm: number;
};

export type PreviewRenderPayloadV1 = {
  version: 1;
  mode: "preview";
  previewSessionId: string;
  eclipseId: string;
  timelineStartUtc: string;
  timelineEndUtc: string;
  initialProgress: number;
  visual: PreviewVisualV1;
};

export type WearRenderPayloadV1 = LiveRenderPayloadV1 | PreviewRenderPayloadV1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function getFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function sanitizeLiveRenderPayloadV1(input: unknown): LiveRenderPayloadV1 | null {
  if (!isRecord(input) || input.version !== 1 || input.mode !== "live") {
    return null;
  }

  const generatedAtUtc = getString(input.generatedAtUtc);
  const watchLatDeg = getFiniteNumber(input.watchLatDeg);
  const watchLonDeg = getFiniteNumber(input.watchLonDeg);

  if (
    !generatedAtUtc ||
    watchLatDeg === null ||
    watchLonDeg === null ||
    watchLatDeg < -90 ||
    watchLatDeg > 90 ||
    watchLonDeg < -180 ||
    watchLonDeg > 180 ||
    typeof input.showMoon !== "boolean"
  ) {
    return null;
  }

  if (!input.showMoon) {
    return {
      version: 1,
      mode: "live",
      generatedAtUtc,
      watchLatDeg,
      watchLonDeg,
      showMoon: false,
    };
  }

  if (!isRecord(input.moon)) {
    return null;
  }

  const radiusNorm = getFiniteNumber(input.moon.radiusNorm);
  const centerXNorm = getFiniteNumber(input.moon.centerXNorm);
  const centerYNorm = getFiniteNumber(input.moon.centerYNorm);

  if (radiusNorm === null || centerXNorm === null || centerYNorm === null) {
    return null;
  }

  return {
    version: 1,
    mode: "live",
    generatedAtUtc,
    watchLatDeg,
    watchLonDeg,
    showMoon: true,
    moon: {
      radiusNorm: clamp01(radiusNorm),
      centerXNorm: clamp01(centerXNorm),
      centerYNorm: clamp01(centerYNorm),
    },
  };
}

export function sanitizePreviewRenderPayloadV1(input: unknown): PreviewRenderPayloadV1 | null {
  if (
    !isRecord(input) ||
    input.version !== 1 ||
    input.mode !== "preview" ||
    !isRecord(input.visual)
  ) {
    return null;
  }

  const previewSessionId = getString(input.previewSessionId);
  const eclipseId = getString(input.eclipseId);
  const timelineStartUtc = getString(input.timelineStartUtc);
  const timelineEndUtc = getString(input.timelineEndUtc);
  const initialProgress = getFiniteNumber(input.initialProgress);
  const sunRadiusNorm = getFiniteNumber(input.visual.sunRadiusNorm);
  const moonRadiusNorm = getFiniteNumber(input.visual.moonRadiusNorm);
  const moonClosestOffsetNorm = getFiniteNumber(input.visual.moonClosestOffsetNorm);
  const moonTravelHalfSpanNorm = getFiniteNumber(input.visual.moonTravelHalfSpanNorm);

  if (
    !previewSessionId ||
    !eclipseId ||
    !timelineStartUtc ||
    !timelineEndUtc ||
    initialProgress === null ||
    sunRadiusNorm === null ||
    moonRadiusNorm === null ||
    moonClosestOffsetNorm === null ||
    moonTravelHalfSpanNorm === null
  ) {
    return null;
  }

  return {
    version: 1,
    mode: "preview",
    previewSessionId,
    eclipseId,
    timelineStartUtc,
    timelineEndUtc,
    initialProgress: clamp01(initialProgress),
    visual: {
      sunRadiusNorm: clamp01(sunRadiusNorm),
      moonRadiusNorm: clamp01(moonRadiusNorm),
      moonClosestOffsetNorm: clamp01(moonClosestOffsetNorm),
      moonTravelHalfSpanNorm: clamp01(moonTravelHalfSpanNorm),
    },
  };
}

export function sanitizeWearRenderPayloadV1(input: unknown): WearRenderPayloadV1 | null {
  if (!isRecord(input) || input.version !== 1) {
    return null;
  }

  if (input.mode === "live") {
    return sanitizeLiveRenderPayloadV1(input);
  }

  if (input.mode === "preview") {
    return sanitizePreviewRenderPayloadV1(input);
  }

  return null;
}

export function createSunOnlyLivePayload(params: {
  generatedAtUtc: string;
  watchLatDeg: number;
  watchLonDeg: number;
}): LiveRenderPayloadV1 {
  return {
    version: 1,
    mode: "live",
    generatedAtUtc: params.generatedAtUtc,
    watchLatDeg: params.watchLatDeg,
    watchLonDeg: params.watchLonDeg,
    showMoon: false,
  };
}
