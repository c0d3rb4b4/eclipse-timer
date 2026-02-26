import type { EclipseKindAtLocation } from "@eclipse-timer/shared";

import {
  calculatePreviewMoonGeometry,
  type PreviewMotionContacts,
  type PreviewTravelVector,
} from "./previewGeometry";

export const PHOTOGRAPHY_GUIDE_PICTURE_OPTIONS = [3, 5, 7, 9] as const;
export type PhotographyGuidePictureCount = (typeof PHOTOGRAPHY_GUIDE_PICTURE_OPTIONS)[number];
export type PhotographyGuidePhaseBucket = "pre-MAX" | "MAX" | "post-MAX";

export type PhotographyGuideRow = {
  index: number;
  iso: string;
  utcMs: number;
  phaseBucket: PhotographyGuidePhaseBucket;
  progress: number;
  showMoon: boolean;
};

export type PhotographyGuideSchedule = {
  rows: PhotographyGuideRow[];
  contacts: PreviewMotionContacts;
  startMs: number;
  endMs: number;
};

export type PhotographyGuideScheduleResult =
  | {
      ok: true;
      schedule: PhotographyGuideSchedule;
    }
  | {
      ok: false;
      reason: string;
    };

type BuildPhotographyGuideScheduleInput = {
  visible: boolean;
  totalPictures: PhotographyGuidePictureCount;
  kindAtLocation: EclipseKindAtLocation;
  c1Utc?: string;
  c2Utc?: string;
  maxUtc?: string;
  c3Utc?: string;
  c4Utc?: string;
};

const PHASE_MAX_TOLERANCE_MS = 500;
const LANDSCAPE_HORIZONTAL_FOV_DEG_24MM = 74;
const LANDSCAPE_VERTICAL_FOV_DEG_24MM = 53;
const SOLAR_DRIFT_DEG_PER_HOUR = 15;
const LANDSCAPE_MAX_ANCHOR_Y_RATIO = 2 / 3;
const LANDSCAPE_MIN_SUN_RADIUS = 8;
const LANDSCAPE_MAX_SUN_RADIUS = 16;
const LANDSCAPE_SUN_RADIUS_WIDTH_RATIO = 0.032;
const LANDSCAPE_MOON_GEOMETRY_STAGE_FACTOR = 8;
const DEFAULT_LANDSCAPE_TRAVEL_VECTOR: PreviewTravelVector = {
  x: 1,
  y: -0.12,
};

export type LandscapeCompositePlacement = {
  index: number;
  iso: string;
  phaseBucket: PhotographyGuidePhaseBucket;
  x: number;
  y: number;
  clamped: boolean;
  showMoon: boolean;
  moon?: {
    x: number;
    y: number;
    radius: number;
  };
};

export type LandscapeCompositeLayout = {
  anchorX: number;
  anchorY: number;
  sunRadius: number;
  placements: LandscapeCompositePlacement[];
};

type BuildLandscapeCompositeLayoutInput = {
  schedule: PhotographyGuideSchedule;
  kindAtLocation: EclipseKindAtLocation;
  magnitude?: number;
  maxUtc?: string;
  frameWidth: number;
  frameHeight: number;
  travelVector?: PreviewTravelVector;
};

function parseUtcMs(iso?: string): number | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampRange(value: number, min: number, max: number) {
  if (max < min) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
}

function isTotalLike(kindAtLocation: EclipseKindAtLocation) {
  return kindAtLocation === "total" || kindAtLocation === "annular";
}

function isSupportedPictureCount(value: number): value is PhotographyGuidePictureCount {
  return (PHOTOGRAPHY_GUIDE_PICTURE_OPTIONS as readonly number[]).includes(value);
}

function buildInteriorIntervalPoints(
  startMs: number,
  endMs: number,
  count: number,
): number[] | null {
  if (count <= 0) return [];
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

  const points: number[] = [];
  for (let index = 1; index <= count; index += 1) {
    const t = startMs + (index / (count + 1)) * (endMs - startMs);
    points.push(t);
  }
  return points;
}

function isStrictAscending(values: number[]) {
  for (let index = 1; index < values.length; index += 1) {
    const prev = values[index - 1];
    const next = values[index];
    if (typeof prev !== "number" || typeof next !== "number") return false;
    if (next <= prev) return false;
  }
  return true;
}

function toProgress(timestampMs: number | undefined, startMs: number, endMs: number) {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs)) return undefined;
  const spanMs = Math.max(1, endMs - startMs);
  return clamp01((timestampMs - startMs) / spanMs);
}

function phaseBucketForTime(timestampMs: number, maxMs: number): PhotographyGuidePhaseBucket {
  if (Math.abs(timestampMs - maxMs) <= PHASE_MAX_TOLERANCE_MS) return "MAX";
  if (timestampMs < maxMs) return "pre-MAX";
  return "post-MAX";
}

function normalizeTravelVector(input: PreviewTravelVector | undefined): PreviewTravelVector {
  const source = input ?? DEFAULT_LANDSCAPE_TRAVEL_VECTOR;
  const magnitude = Math.hypot(source.x, source.y);
  if (!Number.isFinite(magnitude) || magnitude <= 1e-6) {
    return DEFAULT_LANDSCAPE_TRAVEL_VECTOR;
  }
  return {
    x: source.x / magnitude,
    y: source.y / magnitude,
  };
}

function resolveLandscapeMaxMs(schedule: PhotographyGuideSchedule, maxUtc?: string) {
  const maxFromPayload = parseUtcMs(maxUtc);
  if (typeof maxFromPayload === "number") return maxFromPayload;
  const maxRow = schedule.rows.find((row) => row.phaseBucket === "MAX");
  if (maxRow) return maxRow.utcMs;
  const midpointRow = schedule.rows[Math.floor(schedule.rows.length / 2)];
  if (midpointRow) return midpointRow.utcMs;
  return Math.round(schedule.startMs + (schedule.endMs - schedule.startMs) / 2);
}

export function buildPhotographyGuideSchedule(
  input: BuildPhotographyGuideScheduleInput,
): PhotographyGuideScheduleResult {
  if (!isSupportedPictureCount(input.totalPictures)) {
    return {
      ok: false,
      reason: "Unsupported picture count.",
    };
  }

  if (!input.visible || input.kindAtLocation === "none") {
    return {
      ok: false,
      reason: "Must be within eclipse area.",
    };
  }

  const c1Ms = parseUtcMs(input.c1Utc);
  const c2Ms = parseUtcMs(input.c2Utc);
  const maxMs = parseUtcMs(input.maxUtc);
  const c3Ms = parseUtcMs(input.c3Utc);
  const c4Ms = parseUtcMs(input.c4Utc);

  if (typeof c1Ms !== "number" || typeof maxMs !== "number" || typeof c4Ms !== "number") {
    return {
      ok: false,
      reason: "Schedule unavailable for current eclipse timing data.",
    };
  }

  if (!(c1Ms < maxMs && maxMs < c4Ms)) {
    return {
      ok: false,
      reason: "Schedule unavailable for current eclipse timing data.",
    };
  }

  const leftStartMs = c1Ms;
  let leftEndMs = maxMs;
  let rightStartMs = maxMs;
  const rightEndMs = c4Ms;

  if (
    isTotalLike(input.kindAtLocation) &&
    typeof c2Ms === "number" &&
    typeof c3Ms === "number" &&
    c1Ms < c2Ms &&
    c2Ms < maxMs &&
    maxMs < c3Ms &&
    c3Ms < c4Ms
  ) {
    leftEndMs = c2Ms;
    rightStartMs = c3Ms;
  }

  const sideCount = (input.totalPictures - 3) / 2;
  const leftPoints = buildInteriorIntervalPoints(leftStartMs, leftEndMs, sideCount);
  const rightPoints = buildInteriorIntervalPoints(rightStartMs, rightEndMs, sideCount);
  if (!leftPoints || !rightPoints) {
    return {
      ok: false,
      reason: "Schedule unavailable for current eclipse timing data.",
    };
  }

  const coreTimes = [...leftPoints, maxMs, ...rightPoints];
  if (!coreTimes.length) {
    return {
      ok: false,
      reason: "Schedule unavailable for current eclipse timing data.",
    };
  }

  let preMs: number;
  let postMs: number;
  if (coreTimes.length >= 2) {
    const first = coreTimes[0];
    const second = coreTimes[1];
    const penultimate = coreTimes[coreTimes.length - 2];
    const last = coreTimes[coreTimes.length - 1];
    if (
      typeof first !== "number" ||
      typeof second !== "number" ||
      typeof penultimate !== "number" ||
      typeof last !== "number"
    ) {
      return {
        ok: false,
        reason: "Schedule unavailable for current eclipse timing data.",
      };
    }
    const leftGap = second - first;
    const rightGap = last - penultimate;
    if (leftGap <= 0 || rightGap <= 0) {
      return {
        ok: false,
        reason: "Schedule unavailable for current eclipse timing data.",
      };
    }
    preMs = first - leftGap;
    postMs = last + rightGap;
  } else {
    const leftGap = maxMs - leftStartMs;
    const rightGap = rightEndMs - maxMs;
    if (leftGap <= 0 || rightGap <= 0) {
      return {
        ok: false,
        reason: "Schedule unavailable for current eclipse timing data.",
      };
    }
    preMs = leftStartMs - leftGap;
    postMs = rightEndMs + rightGap;
  }

  const rowTimes = [preMs, ...leftPoints, maxMs, ...rightPoints, postMs].map((timestamp) =>
    Math.round(timestamp),
  );

  if (rowTimes.length !== input.totalPictures || !isStrictAscending(rowTimes)) {
    return {
      ok: false,
      reason: "Schedule unavailable for current eclipse timing data.",
    };
  }

  const startMs = rowTimes[0];
  const endMs = rowTimes[rowTimes.length - 1];
  if (typeof startMs !== "number" || typeof endMs !== "number" || endMs <= startMs) {
    return {
      ok: false,
      reason: "Schedule unavailable for current eclipse timing data.",
    };
  }

  const contacts: PreviewMotionContacts = {
    c1: toProgress(c1Ms, startMs, endMs),
    c2: toProgress(c2Ms, startMs, endMs),
    max: toProgress(maxMs, startMs, endMs),
    c3: toProgress(c3Ms, startMs, endMs),
    c4: toProgress(c4Ms, startMs, endMs),
  };

  const rows: PhotographyGuideRow[] = rowTimes.map((timestampMs, index) => {
    return {
      index: index + 1,
      iso: new Date(timestampMs).toISOString(),
      utcMs: timestampMs,
      phaseBucket: phaseBucketForTime(timestampMs, maxMs),
      progress: clamp01((timestampMs - startMs) / (endMs - startMs)),
      showMoon: timestampMs >= c1Ms && timestampMs <= c4Ms,
    };
  });

  return {
    ok: true,
    schedule: {
      rows,
      contacts,
      startMs,
      endMs,
    },
  };
}

export function buildLandscapeCompositeLayout(
  input: BuildLandscapeCompositeLayoutInput,
): LandscapeCompositeLayout {
  const frameWidth = Math.max(1, input.frameWidth);
  const frameHeight = Math.max(1, input.frameHeight);
  const anchorX = frameWidth / 2;
  const anchorY = frameHeight * LANDSCAPE_MAX_ANCHOR_Y_RATIO;
  const sunRadius = clampRange(
    frameWidth * LANDSCAPE_SUN_RADIUS_WIDTH_RATIO,
    LANDSCAPE_MIN_SUN_RADIUS,
    LANDSCAPE_MAX_SUN_RADIUS,
  );
  const minX = sunRadius;
  const maxX = Math.max(sunRadius, frameWidth - sunRadius);
  const minY = sunRadius;
  const maxY = Math.max(sunRadius, frameHeight - sunRadius);
  const maxMs = resolveLandscapeMaxMs(input.schedule, input.maxUtc);
  const travelVector = normalizeTravelVector(input.travelVector);
  const moonGeometryStageSize = Math.max(64, sunRadius * LANDSCAPE_MOON_GEOMETRY_STAGE_FACTOR);

  const placements = input.schedule.rows.map((row) => {
    const offsetHours = (row.utcMs - maxMs) / 3_600_000;
    const offsetDegrees = offsetHours * SOLAR_DRIFT_DEG_PER_HOUR;
    const horizontalNormalized = offsetDegrees / (LANDSCAPE_HORIZONTAL_FOV_DEG_24MM / 2);
    const verticalNormalized = offsetDegrees / (LANDSCAPE_VERTICAL_FOV_DEG_24MM / 2);

    const rawX = anchorX + horizontalNormalized * (frameWidth / 2) * travelVector.x;
    const rawY = anchorY + verticalNormalized * (frameHeight / 2) * travelVector.y;
    const clampedX = clampRange(rawX, minX, maxX);
    const clampedY = clampRange(rawY, minY, maxY);
    const clamped = Math.abs(clampedX - rawX) > 0.01 || Math.abs(clampedY - rawY) > 0.01;

    let moon:
      | {
          x: number;
          y: number;
          radius: number;
        }
      | undefined;
    if (row.showMoon) {
      const moonGeometry = calculatePreviewMoonGeometry({
        progress: row.progress,
        kindAtLocation: input.kindAtLocation,
        magnitude: input.magnitude,
        contacts: input.schedule.contacts,
        stageSize: moonGeometryStageSize,
        sunRadius,
        travelVector,
      });
      const moonOffsetX = moonGeometry.moonCenterX - moonGeometryStageSize / 2;
      const moonOffsetY = moonGeometry.moonCenterY - moonGeometryStageSize / 2;
      moon = {
        x: clampedX + moonOffsetX,
        y: clampedY + moonOffsetY,
        radius: moonGeometry.moonRadius,
      };
    }

    return {
      index: row.index,
      iso: row.iso,
      phaseBucket: row.phaseBucket,
      x: clampedX,
      y: clampedY,
      clamped,
      showMoon: row.showMoon,
      moon,
    };
  });

  return {
    anchorX,
    anchorY,
    sunRadius,
    placements,
  };
}
