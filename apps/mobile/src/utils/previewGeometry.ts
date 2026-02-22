import type { EclipseKindAtLocation } from "@eclipse-timer/shared";

export const PREVIEW_SUN_RADIUS = 72;
export const PREVIEW_STAGE_SIZE = 300;

export type PreviewMotionContacts = {
  c1?: number;
  c2?: number;
  max?: number;
  c3?: number;
  c4?: number;
};

export type PreviewMoonGeometry = {
  moonRadius: number;
  moonClosestOffset: number;
  moonCenterX: number;
  moonCenterY: number;
  moonOffsetX: number;
  moonTravelHalfSpan: number;
};

export type PreviewDirectionBearings = {
  c1BearingDeg?: number;
  c2BearingDeg?: number;
  c3BearingDeg?: number;
  c4BearingDeg?: number;
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function normalizeSignedDeltaDeg(fromDeg: number, toDeg: number) {
  const delta = ((toDeg - fromDeg + 540) % 360) - 180;
  return delta === -180 ? 180 : delta;
}

function resolveDirectionalBearingPair(bearings: PreviewDirectionBearings) {
  const pairs: Array<[number | undefined, number | undefined]> = [
    [bearings.c1BearingDeg, bearings.c4BearingDeg],
    [bearings.c2BearingDeg, bearings.c3BearingDeg],
    [bearings.c1BearingDeg, bearings.c3BearingDeg],
    [bearings.c2BearingDeg, bearings.c4BearingDeg],
  ];

  for (const [start, end] of pairs) {
    if (typeof start !== "number" || !Number.isFinite(start)) continue;
    if (typeof end !== "number" || !Number.isFinite(end)) continue;
    return { start, end };
  }

  return null;
}

export function determinePreviewTravelDirection(
  bearings: PreviewDirectionBearings | undefined,
): 1 | -1 {
  if (!bearings) return 1;
  const pair = resolveDirectionalBearingPair(bearings);
  if (!pair) return 1;
  const delta = normalizeSignedDeltaDeg(pair.start, pair.end);
  return delta >= 0 ? 1 : -1;
}

export function determineMoonRadius(kindAtLocation: EclipseKindAtLocation) {
  if (kindAtLocation === "annular") return 58;
  if (kindAtLocation === "total") return 76;
  if (kindAtLocation === "partial") return 68;
  return 66;
}

export function determineApproachOffset(
  kindAtLocation: EclipseKindAtLocation,
  magnitude: number | undefined,
  moonRadius: number,
  sunRadius = PREVIEW_SUN_RADIUS,
) {
  if (kindAtLocation === "none") {
    return sunRadius + moonRadius + 14;
  }

  if (kindAtLocation === "partial") {
    const safeMag =
      typeof magnitude === "number" && Number.isFinite(magnitude) ? clamp01(magnitude) : 0.6;
    return (1 - safeMag) * (sunRadius + moonRadius - 6);
  }

  return 0;
}

function buildMotionAnchors(
  contacts: PreviewMotionContacts,
  sunRadius: number,
  moonRadius: number,
): Array<{ progress: number; offsetX: number }> {
  const externalTouchOffset = sunRadius + moonRadius;
  const internalTouchOffset = Math.abs(sunRadius - moonRadius);

  const anchors: Array<{ progress: number; offsetX: number }> = [
    { progress: 0, offsetX: -externalTouchOffset },
    { progress: 1, offsetX: externalTouchOffset },
  ];

  const maybePush = (progress: number | undefined, offsetX: number) => {
    if (typeof progress !== "number" || !Number.isFinite(progress)) return;
    anchors.push({ progress: clamp01(progress), offsetX });
  };

  maybePush(contacts.c1, -externalTouchOffset);
  maybePush(contacts.c2, -internalTouchOffset);
  maybePush(contacts.max, 0);
  maybePush(contacts.c3, internalTouchOffset);
  maybePush(contacts.c4, externalTouchOffset);

  return anchors.sort((a, b) => a.progress - b.progress);
}

function interpolateOffsetX(
  progress: number,
  anchors: Array<{ progress: number; offsetX: number }>,
) {
  const clampedProgress = clamp01(progress);
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!first || !last) return 0;
  if (clampedProgress <= first.progress) return first.offsetX;
  if (clampedProgress >= last.progress) return last.offsetX;

  for (let idx = 1; idx < anchors.length; idx += 1) {
    const prev = anchors[idx - 1];
    const next = anchors[idx];
    if (!prev || !next) continue;
    if (clampedProgress > next.progress) continue;
    const span = next.progress - prev.progress;
    if (span <= 0) return next.offsetX;
    const segmentProgress = (clampedProgress - prev.progress) / span;
    return prev.offsetX + (next.offsetX - prev.offsetX) * segmentProgress;
  }

  return last.offsetX;
}

export function calculatePreviewMoonGeometry(params: {
  progress: number;
  kindAtLocation: EclipseKindAtLocation;
  magnitude?: number;
  contacts?: PreviewMotionContacts;
  stageSize?: number;
  sunRadius?: number;
  travelDirection?: 1 | -1;
}): PreviewMoonGeometry {
  const stageSize = params.stageSize ?? PREVIEW_STAGE_SIZE;
  const sunRadius = params.sunRadius ?? PREVIEW_SUN_RADIUS;
  const moonRadius = determineMoonRadius(params.kindAtLocation);
  const moonClosestOffset = determineApproachOffset(
    params.kindAtLocation,
    params.magnitude,
    moonRadius,
    sunRadius,
  );

  const anchors = buildMotionAnchors(params.contacts ?? {}, sunRadius, moonRadius);
  const travelDirection = params.travelDirection ?? 1;
  const moonOffsetX = interpolateOffsetX(params.progress, anchors) * travelDirection;
  const moonCenterX = stageSize / 2 + moonOffsetX;
  const moonCenterY = stageSize / 2 + moonClosestOffset;

  return {
    moonRadius,
    moonClosestOffset,
    moonCenterX,
    moonCenterY,
    moonOffsetX,
    moonTravelHalfSpan: sunRadius + moonRadius,
  };
}
