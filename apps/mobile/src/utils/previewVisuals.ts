import type { EclipseKindAtLocation } from "@eclipse-timer/shared";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function parseUtcMs(iso?: string): number | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function smoothstep01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function smoothstepRange(value: number, start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return value >= end ? 1 : 0;
  }
  return smoothstep01((value - start) / (end - start));
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateTotalityGlowBlend(params: {
  kindAtLocation: EclipseKindAtLocation;
  currentMs: number;
  c2Utc?: string;
  c3Utc?: string;
}) {
  if (params.kindAtLocation !== "total") return 0;

  const c2Ms = parseUtcMs(params.c2Utc);
  const c3Ms = parseUtcMs(params.c3Utc);
  if (typeof c2Ms !== "number" || typeof c3Ms !== "number" || c3Ms <= c2Ms) return 0;

  const totalityDurationMs = c3Ms - c2Ms;
  const fadeInMs = clampRange(totalityDurationMs * 0.2, 8_000, 45_000);
  const fadeOutMs = clampRange(totalityDurationMs * 0.35, 12_000, 80_000);

  const fadeIn = smoothstepRange(params.currentMs, c2Ms - fadeInMs, c2Ms + fadeInMs * 0.35);
  const fadeOut = 1 - smoothstepRange(params.currentMs, c3Ms - fadeOutMs * 0.25, c3Ms + fadeOutMs);

  return clamp01(Math.min(fadeIn, fadeOut));
}
