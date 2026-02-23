import type { EclipseKindAtLocation } from "@eclipse-timer/shared";

export const PREVIEW_SUN_RADIUS = 72;
export const PREVIEW_STAGE_SIZE = 300;
const ANNULAR_RADIUS_RATIO = 58 / PREVIEW_SUN_RADIUS;
const TOTAL_RADIUS_RATIO = 76 / PREVIEW_SUN_RADIUS;
const PARTIAL_RADIUS_RATIO = 68 / PREVIEW_SUN_RADIUS;
const NONE_RADIUS_RATIO = 66 / PREVIEW_SUN_RADIUS;
const NONE_GAP_RATIO = 14 / PREVIEW_SUN_RADIUS;
const PARTIAL_INTERNAL_MARGIN_RATIO = 6 / PREVIEW_SUN_RADIUS;

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

export type PreviewTravelVector = {
  x: number;
  y: number;
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

function bearingDegToUnitCirclePoint(bearingDeg: number): PreviewTravelVector {
  const angleRad = (bearingDeg * Math.PI) / 180;
  return {
    x: Math.sin(angleRad),
    y: -Math.cos(angleRad),
  };
}

export function determinePreviewTravelVector(
  bearings: PreviewDirectionBearings | undefined,
): PreviewTravelVector {
  if (!bearings) return { x: 1, y: 0 };
  const pair = resolveDirectionalBearingPair(bearings);
  if (!pair) return { x: 1, y: 0 };

  const start = bearingDegToUnitCirclePoint(pair.start);
  const end = bearingDegToUnitCirclePoint(pair.end);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const magnitude = Math.hypot(deltaX, deltaY);

  if (!Number.isFinite(magnitude) || magnitude < 1e-6) {
    const fallbackDirection = normalizeSignedDeltaDeg(pair.start, pair.end) >= 0 ? 1 : -1;
    return { x: fallbackDirection, y: 0 };
  }

  return {
    x: deltaX / magnitude,
    y: deltaY / magnitude,
  };
}

export function describePreviewTravelDirection(vector: PreviewTravelVector): string {
  const horizontal = vector.x >= 0 ? "left to right" : "right to left";
  const vertical = vector.y <= -0.2 ? "bottom to top" : vector.y >= 0.2 ? "top to bottom" : "level";

  if (vertical === "level") return horizontal;
  return `${vertical}, ${horizontal}`;
}

export function determineMoonRadius(
  kindAtLocation: EclipseKindAtLocation,
  sunRadius = PREVIEW_SUN_RADIUS,
) {
  if (kindAtLocation === "annular") return sunRadius * ANNULAR_RADIUS_RATIO;
  if (kindAtLocation === "total") return sunRadius * TOTAL_RADIUS_RATIO;
  if (kindAtLocation === "partial") return sunRadius * PARTIAL_RADIUS_RATIO;
  return sunRadius * NONE_RADIUS_RATIO;
}

export function determineApproachOffset(
  kindAtLocation: EclipseKindAtLocation,
  magnitude: number | undefined,
  moonRadius: number,
  sunRadius = PREVIEW_SUN_RADIUS,
) {
  if (kindAtLocation === "none") {
    return sunRadius + moonRadius + sunRadius * NONE_GAP_RATIO;
  }

  if (kindAtLocation === "partial") {
    const safeMag =
      typeof magnitude === "number" && Number.isFinite(magnitude) ? clamp01(magnitude) : 0.6;
    return (1 - safeMag) * (sunRadius + moonRadius - sunRadius * PARTIAL_INTERNAL_MARGIN_RATIO);
  }

  return 0;
}

function buildMotionAnchors(
  contacts: PreviewMotionContacts,
  sunRadius: number,
  moonRadius: number,
  moonClosestOffset: number,
): Array<{ progress: number; offsetX: number }> {
  const axisDistanceForTouchOffset = (touchOffset: number) => {
    const radialSq = touchOffset * touchOffset;
    const closestSq = moonClosestOffset * moonClosestOffset;
    const axisSq = radialSq - closestSq;
    if (!Number.isFinite(axisSq) || axisSq <= 0) return 0;
    return Math.sqrt(axisSq);
  };

  const externalTouchOffset = axisDistanceForTouchOffset(sunRadius + moonRadius);
  const internalTouchOffset = axisDistanceForTouchOffset(Math.abs(sunRadius - moonRadius));

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
  travelVector?: PreviewTravelVector;
}): PreviewMoonGeometry {
  const stageSize = params.stageSize ?? PREVIEW_STAGE_SIZE;
  const sunRadius = params.sunRadius ?? PREVIEW_SUN_RADIUS;
  const moonRadius = determineMoonRadius(params.kindAtLocation, sunRadius);
  const moonClosestOffset = determineApproachOffset(
    params.kindAtLocation,
    params.magnitude,
    moonRadius,
    sunRadius,
  );

  const anchors = buildMotionAnchors(
    params.contacts ?? {},
    sunRadius,
    moonRadius,
    moonClosestOffset,
  );
  const axisOffset = interpolateOffsetX(params.progress, anchors);
  const travelVector = params.travelVector ?? { x: 1, y: 0 };
  const moonOffsetX = axisOffset * travelVector.x - moonClosestOffset * travelVector.y;
  const moonOffsetY = axisOffset * travelVector.y + moonClosestOffset * travelVector.x;
  const moonCenterX = stageSize / 2 + moonOffsetX;
  const moonCenterY = stageSize / 2 + moonOffsetY;

  return {
    moonRadius,
    moonClosestOffset,
    moonCenterX,
    moonCenterY,
    moonOffsetX,
    moonTravelHalfSpan: sunRadius + moonRadius,
  };
}
