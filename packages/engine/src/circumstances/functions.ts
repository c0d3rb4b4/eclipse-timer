import type { EclipseRecord, Observer } from "@eclipse-timer/shared";
import { evalPoly } from "../math/poly";
import { observerToFundamental } from "../geo/coords";

export type EvalAtT = {
  tHours: number;
  x: number;
  y: number;
  d: number;
  mu: number;
  l1: number;
  l2: number;
  xi: number;
  eta: number;
  zeta: number;
  delta: number;    // Δ
  L1obs: number;    // L1 projected to observer plane
  L2obs: number;    // L2 projected to observer plane
};

/**
 * Evaluate all needed quantities at time tHours from t0.
 */
export function evaluateAtT(e: EclipseRecord, o: Observer, tHours: number): EvalAtT {
  const x = evalPoly(e.x, tHours);
  const y = evalPoly(e.y, tHours);
  const d = evalPoly(e.d, tHours);
  const mu = evalPoly(e.mu, tHours);
  const l1 = evalPoly(e.l1, tHours);
  const l2 = evalPoly(e.l2, tHours);

  const { xi, eta, zeta } = observerToFundamental(
  o.latDeg,
  o.lonDeg,
  d,
  mu,
  o.elevM ?? 0
);

  // Distance in the fundamental plane
  const dx = x - xi;
  const dy = y - eta;
  const delta = Math.hypot(dx, dy);

  // Observer-plane radii
  const L1obs = l1 - zeta * e.tanF1;
  const L2obs = l2 - zeta * e.tanF2;

  return { tHours, x, y, d, mu, l1, l2, xi, eta, zeta, delta, L1obs, L2obs };
}

export function fPenumbra(e: EclipseRecord, o: Observer, tHours: number): number {
  const v = evaluateAtT(e, o, tHours);
  return v.delta - v.L1obs;
}

export function fUmbraAbs(e: EclipseRecord, o: Observer, tHours: number): number {
  const v = evaluateAtT(e, o, tHours);
  return v.delta - Math.abs(v.L2obs);
}
