import {
  type EclipseKindAtLocation,
  type PreviewRenderPayloadV1,
  sanitizePreviewRenderPayloadV1,
} from "@eclipse-timer/shared";

import {
  determineApproachOffset,
  determineMoonRadius,
  determinePreviewTravelVector,
  PREVIEW_STAGE_SIZE,
  PREVIEW_SUN_RADIUS,
} from "../utils/previewGeometry";

const DEFAULT_WINDOW_MS = 2 * 60 * 60 * 1000;
const MIN_WINDOW_MS = 5 * 60 * 1000;

export type WearPreviewSourcePayload = {
  eclipseId: string;
  kindAtLocation: EclipseKindAtLocation;
  magnitude?: number;
  c1Utc?: string;
  c2Utc?: string;
  c3Utc?: string;
  c4Utc?: string;
  maxUtc?: string;
  c1BearingDeg?: number;
  c2BearingDeg?: number;
  c3BearingDeg?: number;
  c4BearingDeg?: number;
};

type TimelineBounds = {
  startMs: number;
  endMs: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseUtcMs(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function normalizeContactProgress(
  contactUtc: string | undefined,
  timelineStartMs: number,
  timelineEndMs: number,
): number | undefined {
  const contactMs = parseUtcMs(contactUtc);
  if (typeof contactMs !== "number") return undefined;
  if (timelineEndMs <= timelineStartMs) return undefined;
  return clamp01((contactMs - timelineStartMs) / (timelineEndMs - timelineStartMs));
}

function computeTimelineBounds(source: WearPreviewSourcePayload, nowMs: number): TimelineBounds {
  const c1Ms = parseUtcMs(source.c1Utc);
  const c4Ms = parseUtcMs(source.c4Utc);
  const maxMs = parseUtcMs(source.maxUtc);

  let startMs = c1Ms;
  let endMs = c4Ms;

  if (typeof startMs !== "number" && typeof maxMs === "number") {
    startMs = maxMs - DEFAULT_WINDOW_MS / 2;
  }

  if (typeof endMs !== "number" && typeof maxMs === "number") {
    endMs = maxMs + DEFAULT_WINDOW_MS / 2;
  }

  if (typeof startMs !== "number" || typeof endMs !== "number") {
    startMs = nowMs - DEFAULT_WINDOW_MS / 2;
    endMs = nowMs + DEFAULT_WINDOW_MS / 2;
  }

  if (endMs <= startMs) {
    endMs = startMs + MIN_WINDOW_MS;
  } else if (endMs - startMs < MIN_WINDOW_MS) {
    const midpoint = startMs + (endMs - startMs) / 2;
    startMs = Math.round(midpoint - MIN_WINDOW_MS / 2);
    endMs = Math.round(midpoint + MIN_WINDOW_MS / 2);
  }

  return {
    startMs: Math.round(startMs),
    endMs: Math.round(endMs),
  };
}

export function buildPreviewRenderPayloadV1(params: {
  source: WearPreviewSourcePayload;
  previewSessionId: string;
  nowMs?: number;
}): PreviewRenderPayloadV1 | null {
  const nowMs = params.nowMs ?? Date.now();
  const eclipseId = params.source.eclipseId.trim();
  if (!eclipseId) {
    return null;
  }

  const timeline = computeTimelineBounds(params.source, nowMs);
  const durationMs = Math.max(MIN_WINDOW_MS, timeline.endMs - timeline.startMs);
  const initialProgress = clamp01((nowMs - timeline.startMs) / durationMs);

  const sunRadiusPx = PREVIEW_SUN_RADIUS;
  const moonRadiusPx = determineMoonRadius(params.source.kindAtLocation, sunRadiusPx);
  const moonClosestOffsetPx = determineApproachOffset(
    params.source.kindAtLocation,
    params.source.magnitude,
    moonRadiusPx,
    sunRadiusPx,
  );
  const moonTravelHalfSpanPx = sunRadiusPx + moonRadiusPx;
  const travelVector = determinePreviewTravelVector({
    c1BearingDeg: params.source.c1BearingDeg,
    c2BearingDeg: params.source.c2BearingDeg,
    c3BearingDeg: params.source.c3BearingDeg,
    c4BearingDeg: params.source.c4BearingDeg,
  });
  const c1ProgressNorm = normalizeContactProgress(
    params.source.c1Utc,
    timeline.startMs,
    timeline.endMs,
  );
  const c2ProgressNorm = normalizeContactProgress(
    params.source.c2Utc,
    timeline.startMs,
    timeline.endMs,
  );
  const maxProgressNorm = normalizeContactProgress(
    params.source.maxUtc,
    timeline.startMs,
    timeline.endMs,
  );
  const c3ProgressNorm = normalizeContactProgress(
    params.source.c3Utc,
    timeline.startMs,
    timeline.endMs,
  );
  const c4ProgressNorm = normalizeContactProgress(
    params.source.c4Utc,
    timeline.startMs,
    timeline.endMs,
  );

  return sanitizePreviewRenderPayloadV1({
    version: 1,
    mode: "preview",
    previewSessionId: params.previewSessionId,
    eclipseId,
    timelineStartUtc: new Date(timeline.startMs).toISOString(),
    timelineEndUtc: new Date(timeline.endMs).toISOString(),
    initialProgress,
    visual: {
      sunRadiusNorm: sunRadiusPx / PREVIEW_STAGE_SIZE,
      moonRadiusNorm: moonRadiusPx / PREVIEW_STAGE_SIZE,
      moonClosestOffsetNorm: moonClosestOffsetPx / PREVIEW_STAGE_SIZE,
      moonTravelHalfSpanNorm: moonTravelHalfSpanPx / PREVIEW_STAGE_SIZE,
      travelVectorXNorm: travelVector.x,
      travelVectorYNorm: travelVector.y,
      c1ProgressNorm,
      c2ProgressNorm,
      maxProgressNorm,
      c3ProgressNorm,
      c4ProgressNorm,
    },
  });
}
