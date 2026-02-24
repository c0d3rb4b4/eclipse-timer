import { loadCatalog } from "@eclipse-timer/catalog";
import { computeCircumstances } from "@eclipse-timer/engine";
import {
  type Circumstances,
  createSunOnlyLivePayload,
  type EclipseRecord,
  type LiveMoonGeometryV1,
  type LiveRenderPayloadV1,
  type Observer,
  sanitizeLiveRenderPayloadV1,
} from "@eclipse-timer/shared";

import {
  calculatePreviewMoonGeometry,
  determinePreviewTravelVector,
  PREVIEW_STAGE_SIZE,
  PREVIEW_SUN_RADIUS,
  type PreviewMotionContacts,
} from "../utils/previewGeometry";

const DAY_MS = 24 * 60 * 60 * 1000;

let catalogByDateYmd: Map<string, EclipseRecord[]> | null = null;

export type WearLiveLocationPayload = {
  latitudeDeg: number;
  longitudeDeg: number;
  capturedAtUtc?: string;
  accuracyMeters?: number;
};

export type FindActiveCircumstances = (observer: Observer, nowMs: number) => Circumstances | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseIsoMs(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function toUtcDateYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function buildCatalogByDateYmdIndex(): Map<string, EclipseRecord[]> {
  if (catalogByDateYmd) {
    return catalogByDateYmd;
  }

  const nextIndex = new Map<string, EclipseRecord[]>();
  for (const eclipse of loadCatalog()) {
    const existing = nextIndex.get(eclipse.dateYmd);
    if (existing) {
      existing.push(eclipse);
      continue;
    }
    nextIndex.set(eclipse.dateYmd, [eclipse]);
  }

  catalogByDateYmd = nextIndex;
  return nextIndex;
}

function normalizeContactProgress(
  contactIso: string | undefined,
  c1Ms: number,
  c4Ms: number,
): number | undefined {
  const contactMs = parseIsoMs(contactIso);
  if (typeof contactMs !== "number") return undefined;
  if (c4Ms <= c1Ms) return undefined;
  return clamp01((contactMs - c1Ms) / (c4Ms - c1Ms));
}

function buildPreviewContacts(
  circumstances: Circumstances,
  c1Ms: number,
  c4Ms: number,
): PreviewMotionContacts {
  return {
    c1: 0,
    c2: normalizeContactProgress(circumstances.c2Utc, c1Ms, c4Ms),
    max: normalizeContactProgress(circumstances.maxUtc, c1Ms, c4Ms),
    c3: normalizeContactProgress(circumstances.c3Utc, c1Ms, c4Ms),
    c4: 1,
  };
}

function buildLiveMoonGeometry(
  circumstances: Circumstances,
  nowMs: number,
): LiveMoonGeometryV1 | null {
  if (circumstances.kindAtLocation === "none") {
    return null;
  }

  const c1Ms = parseIsoMs(circumstances.c1Utc);
  const c4Ms = parseIsoMs(circumstances.c4Utc);
  if (typeof c1Ms !== "number" || typeof c4Ms !== "number" || c4Ms <= c1Ms) {
    return null;
  }

  const liveProgress = clamp01((nowMs - c1Ms) / (c4Ms - c1Ms));
  const travelVector = determinePreviewTravelVector({
    c1BearingDeg: circumstances.c1BearingDeg,
    c2BearingDeg: circumstances.c2BearingDeg,
    c3BearingDeg: circumstances.c3BearingDeg,
    c4BearingDeg: circumstances.c4BearingDeg,
  });
  const moon = calculatePreviewMoonGeometry({
    progress: liveProgress,
    kindAtLocation: circumstances.kindAtLocation,
    magnitude: circumstances.magnitude,
    contacts: buildPreviewContacts(circumstances, c1Ms, c4Ms),
    stageSize: PREVIEW_STAGE_SIZE,
    sunRadius: PREVIEW_SUN_RADIUS,
    travelVector,
  });

  const radiusNorm = moon.moonRadius / PREVIEW_STAGE_SIZE;
  const centerXNorm = moon.moonCenterX / PREVIEW_STAGE_SIZE;
  const centerYNorm = moon.moonCenterY / PREVIEW_STAGE_SIZE;

  if (
    !Number.isFinite(radiusNorm) ||
    !Number.isFinite(centerXNorm) ||
    !Number.isFinite(centerYNorm)
  ) {
    return null;
  }

  return {
    radiusNorm,
    centerXNorm,
    centerYNorm,
  };
}

export function parseWearLiveLocationPayload(payloadRaw: string): WearLiveLocationPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadRaw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const messageType = parsed.type;
  if (typeof messageType === "string" && messageType !== "live-location") {
    return null;
  }

  if (!isFiniteNumber(parsed.latitudeDeg) || !isFiniteNumber(parsed.longitudeDeg)) {
    return null;
  }

  if (parsed.latitudeDeg < -90 || parsed.latitudeDeg > 90) {
    return null;
  }

  if (parsed.longitudeDeg < -180 || parsed.longitudeDeg > 180) {
    return null;
  }

  const location: WearLiveLocationPayload = {
    latitudeDeg: parsed.latitudeDeg,
    longitudeDeg: parsed.longitudeDeg,
  };

  if (
    typeof parsed.capturedAtUtc === "string" &&
    Number.isFinite(Date.parse(parsed.capturedAtUtc))
  ) {
    location.capturedAtUtc = parsed.capturedAtUtc;
  }

  if (isFiniteNumber(parsed.accuracyMeters) && parsed.accuracyMeters >= 0) {
    location.accuracyMeters = parsed.accuracyMeters;
  }

  return location;
}

export function isCircumstancesActiveNow(circumstances: Circumstances, nowMs: number): boolean {
  const c1Ms = parseIsoMs(circumstances.c1Utc);
  const c4Ms = parseIsoMs(circumstances.c4Utc);
  if (typeof c1Ms !== "number" || typeof c4Ms !== "number") {
    return false;
  }
  if (c4Ms < c1Ms) {
    return false;
  }
  return c1Ms <= nowMs && nowMs <= c4Ms;
}

export function findActiveCircumstancesAtObserver(
  observer: Observer,
  nowMs: number,
): Circumstances | null {
  const byDate = buildCatalogByDateYmdIndex();
  const candidateDateYmds = new Set([
    toUtcDateYmd(nowMs - DAY_MS),
    toUtcDateYmd(nowMs),
    toUtcDateYmd(nowMs + DAY_MS),
  ]);

  let bestActive: Circumstances | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidateDateYmd of candidateDateYmds) {
    const dayRecords = byDate.get(candidateDateYmd);
    if (!dayRecords?.length) {
      continue;
    }

    for (const eclipse of dayRecords) {
      let circumstances: Circumstances;
      try {
        circumstances = computeCircumstances(eclipse, observer);
      } catch {
        continue;
      }

      if (!isCircumstancesActiveNow(circumstances, nowMs)) {
        continue;
      }

      const maxMs = parseIsoMs(circumstances.maxUtc);
      const score = typeof maxMs === "number" ? Math.abs(maxMs - nowMs) : Number.POSITIVE_INFINITY;

      if (!bestActive || score < bestScore) {
        bestActive = circumstances;
        bestScore = score;
      }
    }
  }

  return bestActive;
}

export function buildLiveRenderPayloadFromLocation(
  location: WearLiveLocationPayload,
  options?: {
    nowMs?: number;
    findActiveCircumstances?: FindActiveCircumstances;
  },
): LiveRenderPayloadV1 {
  const nowMs = options?.nowMs ?? Date.now();
  const generatedAtUtc = new Date(nowMs).toISOString();
  const sunOnlyPayload = createSunOnlyLivePayload({
    generatedAtUtc,
    watchLatDeg: location.latitudeDeg,
    watchLonDeg: location.longitudeDeg,
  });

  const observer: Observer = {
    latDeg: location.latitudeDeg,
    lonDeg: location.longitudeDeg,
    elevM: 0,
  };

  const findActive = options?.findActiveCircumstances ?? findActiveCircumstancesAtObserver;
  const activeCircumstances = findActive(observer, nowMs);
  if (!activeCircumstances) {
    return sunOnlyPayload;
  }

  const moon = buildLiveMoonGeometry(activeCircumstances, nowMs);
  if (!moon) {
    return sunOnlyPayload;
  }

  const maybePayload = sanitizeLiveRenderPayloadV1({
    version: 1,
    mode: "live",
    generatedAtUtc,
    watchLatDeg: location.latitudeDeg,
    watchLonDeg: location.longitudeDeg,
    showMoon: true,
    moon,
  });

  if (!maybePayload || !maybePayload.showMoon) {
    return sunOnlyPayload;
  }

  return maybePayload;
}
