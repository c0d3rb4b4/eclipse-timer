// packages/engine/src/geo/coords.ts
export type ObserverFundamental = {
  xi: number;
  eta: number;
  zeta: number;
};

const DEG2RAD = Math.PI / 180;

// WGS84
const f = 1 / 298.257223563;      // flattening
const e2 = f * (2 - f);           // eccentricity squared

/**
 * Geodetic -> fundamental plane direction cosines.
 *
 * Inputs:
 * - latDeg: geodetic latitude (degrees)
 * - lonDeg: longitude east-positive (degrees)
 * - dDeg: declination-like term from Besselian elements (degrees)
 * - muDeg: hour-angle-like term from Besselian elements (degrees)
 * - elevM: optional elevation (meters). If omitted, 0.
 *
 * Output xi, eta, zeta are in Earth radii (dimensionless) consistent with x,y,l1,l2 units.
 */
export function observerToFundamental(
  latDeg: number,
  lonDeg: number,
  dDeg: number,
  muDeg: number,
  elevM: number = 0
): ObserverFundamental {
  const lat = latDeg * DEG2RAD;
  const lon = lonDeg * DEG2RAD;
  const d = dDeg * DEG2RAD;
  const mu = muDeg * DEG2RAD;

  // NASA Besselian usage expects t in decimal hours; mu is degrees.
  // Hour angle H uses east-positive longitude in our convention:
  const H = mu + lon;

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);

  // Prime vertical radius of curvature (in Earth radii)
  // We treat Earth's equatorial radius as 1 "Earth radius" unit for x,y.
  // Elevation is tiny compared to Earth radius; convert meters to Earth radii.
  const earthEquatorialRadiusM = 6378137.0;
  const h = elevM / earthEquatorialRadiusM;

  const N = 1 / Math.sqrt(1 - e2 * sinLat * sinLat);

  // Geocentric components in Earth radii:
  // rhoCosPhiPrime, rhoSinPhiPrime
  const rhoCosPhiPrime = (N + h) * cosLat;
  const rhoSinPhiPrime = (N * (1 - e2) + h) * sinLat;

  const sinD = Math.sin(d);
  const cosD = Math.cos(d);

  const sinH = Math.sin(H);
  const cosH = Math.cos(H);

  // Fundamental plane direction cosines (with WGS84 rho terms)
  const xi = rhoCosPhiPrime * sinH;
  const eta = rhoSinPhiPrime * cosD - rhoCosPhiPrime * cosH * sinD;
  const zeta = rhoSinPhiPrime * sinD + rhoCosPhiPrime * cosH * cosD;

  return { xi, eta, zeta };
}
