// packages/engine/src/circumstances/compute.ts
import type {
  Circumstances,
  EclipseRecord,
  Observer,
  EclipseKindAtLocation,
} from "@eclipse-timer/shared";
import { findBrackets } from "../math/bracket";
import { bisectRoot } from "../math/root";
import { evaluateShadowMetricsAtT } from "./functions";
import { t0TtDate, ttAtTHours } from "../time/t0";
import { ttToUtcUsingDeltaT, toIsoUtc } from "../time/utc";

type ContactTimes = {
  c1?: number; // hours from t0 (TT/TDT)
  c2?: number;
  max?: number;
  c3?: number;
  c4?: number;
};

function scanMin(
  f: (tHours: number) => number,
  a: number,
  b: number,
  stepHours: number,
): { t: number; val: number } {
  let bestT = a;
  let bestV = Number.POSITIVE_INFINITY;

  for (let t = a; t <= b + 1e-12; t += stepHours) {
    const v = f(t);
    if (Number.isFinite(v) && v < bestV) {
      bestV = v;
      bestT = t;
    }
  }

  return { t: bestT, val: bestV };
}

function solveContacts(
  e: EclipseRecord,
  o: Observer,
): {
  contacts: ContactTimes;
  kindAtLocation: EclipseKindAtLocation;
  maxEval?: ReturnType<typeof evaluateShadowMetricsAtT>;
  debug: Record<string, unknown>;
} {
  // NASA page says valid over 7.00 ≤ t ≤ 13.00 TDT and t0=10.000 ⇒ [-3, +3] hours from t0
  const tMin = -3;
  const tMax = +3;

  // Scan step for bracketing: 60 seconds
  const stepBracket = 1 / 60;

  // Reuse full per-t evaluations across both metrics.
  const metricsCache = new Map<number, ReturnType<typeof evaluateShadowMetricsAtT>>();
  const metricsAt = (t: number): ReturnType<typeof evaluateShadowMetricsAtT> => {
    const cached = metricsCache.get(t);
    if (cached) return cached;
    const next = evaluateShadowMetricsAtT(e, o, t);
    metricsCache.set(t, next);
    return next;
  };

  // --- Solve penumbral roots (C1/C4) ---
  const pen = (t: number) => metricsAt(t).penumbra;
  const penBrackets = findBrackets(pen, tMin, tMax, stepBracket);

  const penRootResults = penBrackets.map((b) => bisectRoot(pen, b.a, b.b, 1e-7));
  const penRoots = penRootResults
    .filter((r): r is NonNullable<typeof r> => !!r && r.ok && Number.isFinite(r.tHours))
    .map((r) => r.tHours)
    .sort((a, b) => a - b);

  const c1 = penRoots[0];
  const c4 = penRoots.length >= 2 ? penRoots[penRoots.length - 1] : undefined;

  // --- Solve umbra/antumbra roots (C2/C3) ---
  const umb = (t: number) => metricsAt(t).umbraAbs;
  const umbBrackets = findBrackets(umb, tMin, tMax, stepBracket);

  const umbRootResults = umbBrackets.map((b) => bisectRoot(umb, b.a, b.b, 1e-7));
  const umbRoots = umbRootResults
    .filter((r): r is NonNullable<typeof r> => !!r && r.ok && Number.isFinite(r.tHours))
    .map((r) => r.tHours)
    .sort((a, b) => a - b);

  const c2 = umbRoots[0];
  const c3 = umbRoots.length >= 2 ? umbRoots[umbRoots.length - 1] : undefined;

  // Visible if we have sane C1 and C4
  const visible =
    typeof c1 === "number" && Number.isFinite(c1) && typeof c4 === "number" && Number.isFinite(c4);

  // Determine kind at location:
  let kindAtLocation: EclipseKindAtLocation = "none";
  if (!visible) {
    kindAtLocation = "none";
  } else if (
    typeof c1 === "number" &&
    Number.isFinite(c1) &&
    typeof c4 === "number" &&
    Number.isFinite(c4) &&
    typeof c2 === "number" &&
    Number.isFinite(c2) &&
    typeof c3 === "number" &&
    Number.isFinite(c3) &&
    c2 > c1 &&
    c3 < c4
  ) {
    // Decide total vs annular based on sign of L2obs near maximum.
    // We'll compute bestT first below, then decide.
    kindAtLocation = "total"; // temporary, corrected after bestT is chosen
  } else {
    kindAtLocation = "partial";
  }

  // --- Choose max time (this is “Next 1”) ---
  // For total/annular: choose max inside [C2, C3] by minimizing Δ - |L2obs|
  // For partial: choose max inside [C1, C4] by minimizing Δ - L1obs
  const stepFine = 1 / 600; // 6 seconds in hours
  let bestT: number | undefined;
  let bestMetric: number | undefined;
  let maxEval: ReturnType<typeof evaluateShadowMetricsAtT> | undefined;

  if (visible && typeof c2 === "number" && typeof c3 === "number" && c3 > c2) {
    const r = scanMin(umb, c2, c3, stepFine);
    bestT = r.t;
    bestMetric = r.val;

    const vAtMax = metricsAt(bestT);
    maxEval = vAtMax;
    kindAtLocation = vAtMax.L2obs < 0 ? "total" : "annular";
  } else if (visible && typeof c1 === "number" && typeof c4 === "number" && c4 > c1) {
    const r = scanMin(pen, c1, c4, stepFine);
    bestT = r.t;
    bestMetric = r.val;
    maxEval = metricsAt(bestT);
    kindAtLocation = "partial";
  } else {
    // fallback: scan whole window minimizing delta
    let bestDelta = Number.POSITIVE_INFINITY;
    let bestTFallback = 0;
    for (let t = tMin; t <= tMax + 1e-12; t += stepBracket) {
      const v = metricsAt(t);
      if (Number.isFinite(v.delta) && v.delta < bestDelta) {
        bestDelta = v.delta;
        bestTFallback = t;
      }
    }
    bestT = bestTFallback;
    maxEval = metricsAt(bestTFallback);
    bestMetric = undefined;
    kindAtLocation = visible ? "partial" : "none";
  }

  return {
    contacts: { c1, c2, max: bestT, c3, c4 },
    kindAtLocation,
    maxEval,
    debug: {
      // scan/roots
      penBracketsCount: penBrackets.length,
      umbBracketsCount: umbBrackets.length,
      penRoots,
      umbRoots,
      penRootResults,
      umbRootResults,

      // max selection
      bestT_hours: bestT,
      bestMetric,
    },
  };
}

export function computeCircumstances(e: EclipseRecord, o: Observer): Circumstances {
  const { contacts, kindAtLocation, maxEval, debug } = solveContacts(e, o);
  const fallbackMaxT =
    typeof contacts.max === "number" && Number.isFinite(contacts.max) ? contacts.max : 0;
  const v = maxEval ?? evaluateShadowMetricsAtT(e, o, fallbackMaxT);

  const t0tt = t0TtDate(e);

  const toUtcIso = (tHours: number | undefined): string | undefined => {
    if (typeof tHours !== "number" || !Number.isFinite(tHours)) return undefined;
    const tt = ttAtTHours(e, tHours); // TT instant
    const utc = ttToUtcUsingDeltaT(tt, e); // approx UTC from ΔT
    return toIsoUtc(utc);
  };

  const c1Utc = toUtcIso(contacts.c1);
  const c2Utc = toUtcIso(contacts.c2);
  const maxUtc = toUtcIso(contacts.max);
  const c3Utc = toUtcIso(contacts.c3);
  const c4Utc = toUtcIso(contacts.c4);

  const visible = typeof contacts.c1 === "number" && typeof contacts.c4 === "number";

  let durationSeconds: number | undefined;
  if (
    typeof contacts.c2 === "number" &&
    typeof contacts.c3 === "number" &&
    contacts.c3 > contacts.c2
  ) {
    durationSeconds = (contacts.c3 - contacts.c2) * 3600;
  }

  let magnitude: number | undefined;

  if (!visible || !v || !Number.isFinite(v.L1obs) || v.L1obs <= 0) {
    magnitude = undefined;
  } else if (kindAtLocation === "total" || kindAtLocation === "annular") {
    magnitude = 1;
  } else {
    // partial eclipse
    const raw = (v.L1obs - v.delta) / v.L1obs;
    magnitude = Math.max(0, Math.min(1, raw));
  }

  return {
    eclipseId: e.id,
    visible,
    kindAtLocation: visible ? kindAtLocation : "none",
    c1Utc,
    c2Utc,
    maxUtc,
    c3Utc,
    c4Utc,
    durationSeconds,
    magnitude,
    _debug: {
      t0Tt: t0tt.toISOString(),
      t0UtcApprox: ttToUtcUsingDeltaT(t0tt, e).toISOString(),
      deltaTSeconds: e.deltaTSeconds,
      nasaGreatestEclipseUtc: e.greatestEclipseUtc,
      ...debug,
    },
  };
}
