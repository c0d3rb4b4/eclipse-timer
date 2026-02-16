import type { LatLng, Region } from "react-native-maps";

type OverlayCell = LatLng[];
const overlayCellsCache = new WeakMap<[number, number][][], OverlayCell[]>();

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function normalizeLongitude(lonDeg: number): number {
  let lon = lonDeg;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

export function sanitizeLatitude(latDeg: number): number {
  return clamp(latDeg, -85, 85);
}

export function sanitizeDelta(delta: number, fallback: number): number {
  if (!Number.isFinite(delta)) return fallback;
  return clamp(Math.abs(delta), 0.02, 180);
}

export function sanitizeRegion(region: Region, fallback?: Region): Region {
  const fb = fallback ?? {
    latitude: 0,
    longitude: 0,
    latitudeDelta: 8,
    longitudeDelta: 8,
  };

  return {
    latitude: sanitizeLatitude(Number.isFinite(region.latitude) ? region.latitude : fb.latitude),
    longitude: normalizeLongitude(
      Number.isFinite(region.longitude) ? region.longitude : fb.longitude,
    ),
    latitudeDelta: sanitizeDelta(region.latitudeDelta, fb.latitudeDelta),
    longitudeDelta: sanitizeDelta(region.longitudeDelta, fb.longitudeDelta),
  };
}

export function overlayTuplesToCells(polygons: [number, number][][] | undefined): OverlayCell[] {
  if (!polygons?.length) return [];
  const cached = overlayCellsCache.get(polygons);
  if (cached) return cached;

  const cells = polygons
    .map((poly) =>
      poly
        .map(([lat, lon]) => ({
          latitude: sanitizeLatitude(lat),
          longitude: normalizeLongitude(lon),
        }))
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
    )
    .filter((poly) => poly.length >= 3);
  const split = cells.flatMap((poly) => splitPolygonOnDateline(poly));
  overlayCellsCache.set(polygons, split);
  return split;
}

function splitPolygonOnDateline(poly: OverlayCell): OverlayCell[] {
  if (poly.length < 3) return [];
  const out: OverlayCell[] = [];
  let current: OverlayCell = [];

  const pushCurrent = () => {
    if (current.length >= 3) out.push(current);
    current = [];
  };

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a || !b) continue;
    if (!current.length) current.push({ ...a });

    const delta = b.longitude - a.longitude;
    if (Math.abs(delta) <= 180) {
      current.push({ ...b });
      continue;
    }

    const crossingLon = delta > 180 ? -180 : 180;
    let lonB = b.longitude;
    if (delta > 180) lonB -= 360;
    else lonB += 360;

    const t = (crossingLon - a.longitude) / (lonB - a.longitude);
    const latCross = a.latitude + t * (b.latitude - a.latitude);
    const crossPoint = { latitude: latCross, longitude: crossingLon };

    current.push(crossPoint);
    pushCurrent();

    const oppositeLon = crossingLon === 180 ? -180 : 180;
    current.push({ latitude: latCross, longitude: oppositeLon });
    current.push({ ...b });
  }

  pushCurrent();
  return out;
}
