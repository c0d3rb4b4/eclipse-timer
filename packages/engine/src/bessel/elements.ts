import type { EclipseRecord } from "@eclipse-timer/shared";
import { evalPoly } from "../math/poly";

export type BesselAtT = {
  x: number;
  y: number;
  d: number;
  mu: number;
  l1: number;
  l2: number;
};

/**
 * Evaluate Besselian element polynomials at time offset t (minutes from t0).
 */
export function evalElements(e: EclipseRecord, tHoursFromT0: number): BesselAtT {
  return {
    x: evalPoly(e.x, tHoursFromT0),
    y: evalPoly(e.y, tHoursFromT0),
    d: evalPoly(e.d, tHoursFromT0),
    mu: evalPoly(e.mu, tHoursFromT0),
    l1: evalPoly(e.l1, tHoursFromT0),
    l2: evalPoly(e.l2, tHoursFromT0)
  };
}
