/**
 * build_overlays_json.ts
 *
 * Generates overlays.generated.json — a map of eclipse ID → { visible, central }
 * polygon data.
 *
 * Both the visible (penumbra) and central (umbra/antumbra) bands are generated
 * by sweeping time and tracing the shadow outline at each timestep via bisection
 * along radial bearings from the shadow axis. The per-timestep outlines are then
 * stitched into a continuous band polygon by collecting the northern edge going
 * forward in time and the southern edge going backward.
 *
 * Run:  pnpm tsx scripts/build_overlays_json.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EclipseRecord, OverlayPoint } from "@eclipse-timer/shared";
import { evaluateAtT } from "../../engine/src/circumstances/functions.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.resolve(__dirname, "../generated/catalog.generated.json");
const outPath = path.resolve(__dirname, "../generated/overlays.generated.json");

function outChunkPath(decade: number): string {
  return path.resolve(__dirname, `../generated/overlays.${decade}s.generated.json`);
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
const T_MIN = -3;
const T_MAX = 3;
/** Time step for penumbra sweep (hours). ~6 min gives smooth visible bands. */
const TIME_STEP_VISIBLE = 6 / 60;
/** Time step for umbra sweep (hours). ~3 min since umbra moves faster & is narrower. */
const TIME_STEP_CENTRAL = 3 / 60;
/** Number of bearing samples around 360° for each timestep. */
const BEARING_SAMPLES_VISIBLE = 120;
const BEARING_SAMPLES_CENTRAL = 72;
/** Bisection iterations to find the shadow edge at a given bearing. */
const BISECT_ITERS = 22;
/** Max search radius in degrees from shadow axis. */
const PEN_SEARCH_DEG = 80;
const UMB_SEARCH_DEG = 10;
/** Douglas-Peucker simplification tolerance (degrees). */
const SIMPLIFY_VIS_DEG = 0.15;
const SIMPLIFY_CEN_DEG = 0.08;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

function destPoint(
  latDeg: number,
  lonDeg: number,
  bearingDeg: number,
  distDeg: number
): [number, number] {
  const lat1 = latDeg * DEG2RAD;
  const brng = bearingDeg * DEG2RAD;
  const d = distDeg * DEG2RAD;
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinD = Math.sin(d);
  const cosD = Math.cos(d);
  const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(brng));
  const lon2 =
    lonDeg * DEG2RAD +
    Math.atan2(
      Math.sin(brng) * sinD * cosLat1,
      cosD - sinLat1 * Math.sin(lat2)
    );
  return [lat2 * RAD2DEG, ((lon2 * RAD2DEG + 540) % 360) - 180];
}

function normLon(lon: number): number {
  return ((lon % 360) + 540) % 360 - 180;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Shadow-axis position at time t
// ---------------------------------------------------------------------------

function shadowAxisLatLon(
  e: EclipseRecord,
  tHours: number
): [number, number] | null {
  const v = evaluateAtT(e, { latDeg: 0, lonDeg: 0, elevM: 0 }, tHours);
  const sinD = Math.sin(v.d * DEG2RAD);
  const cosD = Math.cos(v.d * DEG2RAD);
  const r2 = v.x * v.x + v.y * v.y;

  // If r² > ~2.5, the shadow is completely off Earth — skip
  if (r2 > 2.5) return null;

  // Compute the z-component on the unit sphere.
  // When r²<1, the axis intersects Earth; when r²≥1 we project to nearest
  // surface point by clamping zeta to 0.
  const zeta0 = r2 < 1 ? Math.sqrt(1 - r2) : 0;

  // Convert from fundamental plane (x, y, zeta) to geocentric:
  //   The fundamental plane is oriented so that the z-axis points along the
  //   shadow axis (declination d). To invert:
  //     sinLat = sinD * zeta0 + y * cosD
  //     H (hour angle) = atan2(x, cosD * zeta0 - y * sinD)
  //     lon = H - mu  (mu is Greenwich Hour Angle in degrees)
  const sinLat = sinD * zeta0 + v.y * cosD;
  const lat = Math.asin(clamp(sinLat, -1, 1)) * RAD2DEG;
  const cosLatZ = cosD * zeta0 - v.y * sinD;
  const H = Math.atan2(v.x, cosLatZ); // radians
  const lon = normLon((H - v.mu * DEG2RAD) * RAD2DEG);

  return [clamp(lat, -89, 89), lon];
}

// ---------------------------------------------------------------------------
// Metric functions
// ---------------------------------------------------------------------------

function penumbraMetric(
  e: EclipseRecord,
  obs: { latDeg: number; lonDeg: number; elevM: number },
  tHours: number
): number {
  const v = evaluateAtT(e, obs, tHours);
  return v.delta - v.L1obs;
}

function umbraMetric(
  e: EclipseRecord,
  obs: { latDeg: number; lonDeg: number; elevM: number },
  tHours: number
): number {
  const v = evaluateAtT(e, obs, tHours);
  return v.delta - Math.abs(v.L2obs);
}

type MetricFn = typeof penumbraMetric;

// ---------------------------------------------------------------------------
// Shadow-edge finder: bisect along a bearing
// ---------------------------------------------------------------------------

function findEdgeAlongBearing(
  e: EclipseRecord,
  tHours: number,
  centerLat: number,
  centerLon: number,
  bearingDeg: number,
  maxRadiusDeg: number,
  metricFn: MetricFn
): OverlayPoint | null {
  const loVal0 = metricFn(
    e,
    { latDeg: centerLat, lonDeg: centerLon, elevM: 0 },
    tHours
  );
  const [farLat, farLon] = destPoint(
    centerLat,
    centerLon,
    bearingDeg,
    maxRadiusDeg
  );
  const hiVal0 = metricFn(
    e,
    { latDeg: farLat, lonDeg: farLon, elevM: 0 },
    tHours
  );

  if (loVal0 >= 0 && hiVal0 >= 0) return null;
  if (loVal0 < 0 && hiVal0 < 0)
    return [clamp(farLat, -89.9, 89.9), normLon(farLon)];

  let lo = 0;
  let hi = maxRadiusDeg;
  let loVal = loVal0;

  for (let i = 0; i < BISECT_ITERS; i++) {
    const mid = (lo + hi) / 2;
    const [mLat, mLon] = destPoint(centerLat, centerLon, bearingDeg, mid);
    const mVal = metricFn(
      e,
      { latDeg: mLat, lonDeg: mLon, elevM: 0 },
      tHours
    );
    if ((loVal < 0) === (mVal < 0)) {
      lo = mid;
      loVal = mVal;
    } else {
      hi = mid;
    }
  }

  const fd = (lo + hi) / 2;
  const [lat, lon] = destPoint(centerLat, centerLon, bearingDeg, fd);
  return [clamp(lat, -89.9, 89.9), normLon(lon)];
}

// ---------------------------------------------------------------------------
// Trace one shadow outline at a fixed time
// ---------------------------------------------------------------------------

function traceOutlineAtTime(
  e: EclipseRecord,
  tHours: number,
  centerLat: number,
  centerLon: number,
  maxRadiusDeg: number,
  metricFn: MetricFn,
  numBearings: number
): OverlayPoint[] {
  const points: OverlayPoint[] = [];
  for (let i = 0; i < numBearings; i++) {
    const bearing = (360 * i) / numBearings;
    const pt = findEdgeAlongBearing(
      e,
      tHours,
      centerLat,
      centerLon,
      bearing,
      maxRadiusDeg,
      metricFn
    );
    if (pt) points.push(pt);
  }
  return points;
}

// ---------------------------------------------------------------------------
// Douglas-Peucker simplification
// ---------------------------------------------------------------------------

function perpDist(
  p: OverlayPoint,
  a: OverlayPoint,
  b: OverlayPoint
): number {
  const dx = b[1] - a[1];
  const dy = b[0] - a[0];
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-14) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = clamp(((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / lenSq, 0, 1);
  return Math.hypot(p[0] - (a[0] + t * dy), p[1] - (a[1] + t * dx));
}

function douglasPeucker(
  points: OverlayPoint[],
  tolerance: number
): OverlayPoint[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function simplifyPath(
  pts: OverlayPoint[],
  tolerance: number
): OverlayPoint[] {
  if (pts.length <= 2) return pts;
  return douglasPeucker(pts, tolerance);
}

// ---------------------------------------------------------------------------
// Build visible (penumbra) polygon — outer envelope tracing
// ---------------------------------------------------------------------------

/**
 * For the visible (penumbra) overlay, the shadow is a large ≈4 000 km wide
 * circle at each timestep. The union of these overlapping circles over time
 * forms a smooth elongated oval.
 *
 * We trace the **outer envelope** directly:
 *   1. At each timestep, trace the full penumbra outline (boundary points
 *      at evenly-spaced bearings from that timestep's shadow-axis center).
 *   2. For every boundary point, compute its bearing from the overall
 *      centroid and bin it into one of N angular buckets.
 *   3. In each bucket, keep only the point farthest from the centroid.
 *
 * This produces a smooth closed polygon with at most N vertices that
 * accurately represents the outer boundary of the penumbra union.
 */
function buildVisiblePolygon(
  e: EclipseRecord,
  outlines: { t: number; center: OverlayPoint }[],
  tolerance: number
): OverlayPoint[][] {
  if (outlines.length === 0) return [];

  // Overall centroid of all shadow-axis positions (spherical mean)
  const centroid = outlineCenter(outlines.map((o) => o.center));

  const numBuckets = BEARING_SAMPLES_VISIBLE;
  // Each bucket: best point and its distance from centroid
  const buckets: { pt: OverlayPoint; dist: number }[] = new Array(numBuckets);

  for (const frame of outlines) {
    // Trace the penumbra outline at this timestep
    const outline = traceOutlineAtTime(
      e,
      frame.t,
      frame.center[0],
      frame.center[1],
      PEN_SEARCH_DEG,
      penumbraMetric,
      numBuckets
    );

    for (const pt of outline) {
      // Bearing from centroid to this boundary point
      const bearing = bearingFromTo(
        centroid[0],
        centroid[1],
        pt[0],
        pt[1]
      );
      // Map bearing [0, 360) into a bucket index
      const bucketIdx =
        Math.floor((bearing / 360) * numBuckets) % numBuckets;

      const dist = angularDistance(centroid[0], centroid[1], pt[0], pt[1]);

      if (!buckets[bucketIdx] || dist > buckets[bucketIdx].dist) {
        buckets[bucketIdx] = { pt, dist };
      }
    }
  }

  // Fill empty buckets by interpolating between nearest filled neighbors
  // (great-circle interpolation to handle wide spherical spans).
  for (let i = 0; i < numBuckets; i++) {
    if (buckets[i]) continue;

    // Find nearest filled bucket before and after
    let prevIdx = -1;
    for (let d = 1; d < numBuckets; d++) {
      const idx = (i - d + numBuckets) % numBuckets;
      if (buckets[idx]) { prevIdx = idx; break; }
    }
    let nextIdx = -1;
    for (let d = 1; d < numBuckets; d++) {
      const idx = (i + d) % numBuckets;
      if (buckets[idx]) { nextIdx = idx; break; }
    }
    if (prevIdx < 0 || nextIdx < 0) continue;

    // How far are we between prevIdx and nextIdx?
    const gapSize =
      ((nextIdx - prevIdx + numBuckets) % numBuckets) || numBuckets;
    const pos = ((i - prevIdx + numBuckets) % numBuckets) || numBuckets;
    const frac = pos / gapSize;

    // Spherical linear interpolation (SLERP) between the two filled points
    const p1 = buckets[prevIdx].pt;
    const p2 = buckets[nextIdx].pt;
    const interp = sphericalInterp(p1[0], p1[1], p2[0], p2[1], frac);
    buckets[i] = {
      pt: interp,
      dist: angularDistance(centroid[0], centroid[1], interp[0], interp[1]),
    };
  }

  // Collect the envelope points in bearing order
  const envelope: OverlayPoint[] = [];
  for (let i = 0; i < numBuckets; i++) {
    if (buckets[i]) envelope.push(buckets[i].pt);
  }

  if (envelope.length < 3) return [];

  // The envelope is already a smooth closed polygon ordered by bearing
  // from the centroid. We skip Douglas-Peucker simplification because the
  // perpDist function uses Euclidean distance in the lat/lon plane, which
  // corrupts polygons spanning >180° of longitude.
  return [envelope];
}

/**
 * Initial bearing (forward azimuth) from point 1 to point 2, in degrees [0, 360).
 */
function bearingFromTo(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = (lon2 - lon1) * DEG2RAD;
  const la1 = lat1 * DEG2RAD;
  const la2 = lat2 * DEG2RAD;
  const y = Math.sin(dLon) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) -
    Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * RAD2DEG) + 360) % 360;
}

/**
 * Spherical linear interpolation between two lat/lon points.
 * frac=0 → p1, frac=1 → p2.
 */
function sphericalInterp(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  frac: number
): OverlayPoint {
  const la1 = lat1 * DEG2RAD;
  const lo1 = lon1 * DEG2RAD;
  const la2 = lat2 * DEG2RAD;
  const lo2 = lon2 * DEG2RAD;

  // Convert to unit-sphere Cartesian
  const x1 = Math.cos(la1) * Math.cos(lo1);
  const y1 = Math.cos(la1) * Math.sin(lo1);
  const z1 = Math.sin(la1);
  const x2 = Math.cos(la2) * Math.cos(lo2);
  const y2 = Math.cos(la2) * Math.sin(lo2);
  const z2 = Math.sin(la2);

  // Linear interpolation on Cartesian coords (good enough for our purposes)
  const xm = x1 + frac * (x2 - x1);
  const ym = y1 + frac * (y2 - y1);
  const zm = z1 + frac * (z2 - z1);

  // Back to lat/lon
  const lat = Math.atan2(zm, Math.sqrt(xm * xm + ym * ym)) * RAD2DEG;
  const lon = Math.atan2(ym, xm) * RAD2DEG;
  return [clamp(lat, -89.9, 89.9), normLon(lon)];
}

/**
 * Angular distance between two lat/lon points in degrees (Haversine).
 */
function angularDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) *
      Math.cos(lat2 * DEG2RAD) *
      Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(a)) * RAD2DEG;
}

// ---------------------------------------------------------------------------
// Build band polygon from per-timestep outlines (for central/umbra path)
// ---------------------------------------------------------------------------

/**
 * From an array of per-timestep shadow outlines sorted by time, build a
 * continuous band polygon. Strategy:
 *
 *   1. At each timestep, find the "left" and "right" edge points
 *      (perpendicular to the sweep direction).
 *   2. Band = left-edge going forward → trailing cap → right-edge reversed
 *      → leading cap (closed).
 *
 * This approach works well for narrow band shapes like the umbra/antumbra
 * central path.
 */
function buildBandPolygon(
  outlines: { t: number; points: OverlayPoint[] }[],
  tolerance: number
): OverlayPoint[][] {
  const valid = outlines.filter((o) => o.points.length >= 3);
  if (valid.length === 0) return [];
  valid.sort((a, b) => a.t - b.t);

  if (valid.length === 1) {
    // Single timestep: just return the outline ring
    const ring = valid[0]!.points;
    const s = simplifyPath(ring, tolerance);
    return s.length >= 3 ? [s] : [];
  }

  // Compute the shadow sweep direction from first to last center
  const firstCenter = outlineCenter(valid[0]!.points);
  const lastCenter = outlineCenter(valid[valid.length - 1]!.points);
  const sweepDx = lastCenter[1] - firstCenter[1];
  const sweepDy = lastCenter[0] - firstCenter[0];
  // Handle dateline wrap for sweep direction
  const adjustedSweepDx =
    Math.abs(sweepDx) > 180
      ? sweepDx > 0
        ? sweepDx - 360
        : sweepDx + 360
      : sweepDx;
  const sweepAngle = Math.atan2(adjustedSweepDx, sweepDy);
  // perpendicular: "left" of sweep = +90°
  const perpAngle = sweepAngle + Math.PI / 2;
  const perpDx = Math.sin(perpAngle);
  const perpDy = Math.cos(perpAngle);

  // For each timestep, find the "left-most" and "right-most" edge points
  // relative to the sweep direction (perpendicular component).
  // "Left" = positive perpendicular, "Right" = negative perpendicular.
  const leftEdge: OverlayPoint[] = [];
  const rightEdge: OverlayPoint[] = [];

  for (const frame of valid) {
    const center = outlineCenter(frame.points);
    let bestLeftScore = -Infinity;
    let bestLeftPt: OverlayPoint = frame.points[0]!;
    let bestRightScore = Infinity;
    let bestRightPt: OverlayPoint = frame.points[0]!;

    for (const p of frame.points) {
      let dl = p[1] - center[1];
      if (dl > 180) dl -= 360;
      if (dl < -180) dl += 360;
      const score = dl * perpDx + (p[0] - center[0]) * perpDy;
      if (score > bestLeftScore) {
        bestLeftScore = score;
        bestLeftPt = p;
      }
      if (score < bestRightScore) {
        bestRightScore = score;
        bestRightPt = p;
      }
    }

    leftEdge.push([bestLeftPt[0], bestLeftPt[1]]);
    rightEdge.push([bestRightPt[0], bestRightPt[1]]);
  }

  // Leading cap: first outline, sorted from right-edge to left-edge
  // (going "counter-sweep" around the cap)
  const firstPts = valid[0]!.points;
  const firstCtr = outlineCenter(firstPts);
  const leadingCap = sortByPerpProjection(firstPts, firstCtr, perpDx, perpDy);

  // Trailing cap: last outline, sorted from left-edge to right-edge
  const lastPts = valid[valid.length - 1]!.points;
  const lastCtr = outlineCenter(lastPts);
  const trailingCap = sortByPerpProjection(
    lastPts,
    lastCtr,
    perpDx,
    perpDy
  ).reverse();

  // Assemble: leftEdge forward → trailingCap → rightEdge reversed → leadingCap
  const band: OverlayPoint[] = [
    ...leftEdge,
    ...trailingCap,
    ...rightEdge.reverse(),
    ...leadingCap,
  ];

  if (band.length < 3) return [];

  const simplified = simplifyPath(band, tolerance);
  return simplified.length >= 3 ? [simplified] : [];
}

function outlineCenter(pts: OverlayPoint[]): OverlayPoint {
  let sLat = 0;
  let sLon = 0;
  // Use circular mean for longitude to handle dateline
  let sinSum = 0;
  let cosSum = 0;
  for (const p of pts) {
    sLat += p[0];
    sinSum += Math.sin(p[1] * DEG2RAD);
    cosSum += Math.cos(p[1] * DEG2RAD);
  }
  sLon = Math.atan2(sinSum, cosSum) * RAD2DEG;
  return [sLat / pts.length, sLon];
}

function sortByPerpProjection(
  pts: OverlayPoint[],
  center: OverlayPoint,
  perpDx: number,
  perpDy: number
): OverlayPoint[] {
  return [...pts].sort((a, b) => {
    let adl = a[1] - center[1];
    if (adl > 180) adl -= 360;
    if (adl < -180) adl += 360;
    let bdl = b[1] - center[1];
    if (bdl > 180) bdl -= 360;
    if (bdl < -180) bdl += 360;
    const sa = adl * perpDx + (a[0] - center[0]) * perpDy;
    const sb = bdl * perpDx + (b[0] - center[0]) * perpDy;
    return sa - sb;
  });
}

// ---------------------------------------------------------------------------
// Per-eclipse overlay builder
// ---------------------------------------------------------------------------

type OverlayResult = {
  overlayVisiblePolygons: OverlayPoint[][];
  overlayCentralPolygons: OverlayPoint[][];
};

function buildOverlaysForEclipse(e: EclipseRecord): OverlayResult {
  const kind = String((e as any).kind ?? "P").toUpperCase()[0];
  const isPartial = kind === "P";

  // ------------------------------------------------------------------
  // Visible (penumbra) overlay — outer envelope tracing
  // ------------------------------------------------------------------
  // Collect timesteps where the penumbra touches Earth, with their
  // shadow-axis center positions. buildVisiblePolygon will do its own
  // edge-finding per bearing across all these timesteps.
  const visFrames: { t: number; center: OverlayPoint }[] = [];

  for (let t = T_MIN; t <= T_MAX + 1e-9; t += TIME_STEP_VISIBLE) {
    const center = shadowAxisLatLon(e, t);
    if (!center) continue;

    // Check if penumbra touches Earth at this time
    const cVal = penumbraMetric(
      e,
      { latDeg: center[0], lonDeg: center[1], elevM: 0 },
      t
    );
    if (cVal >= 0) continue;

    visFrames.push({ t, center });
  }

  const visiblePolygons = buildVisiblePolygon(e, visFrames, SIMPLIFY_VIS_DEG);

  // ------------------------------------------------------------------
  // Central (umbra/antumbra) overlay — ray-traced band
  // ------------------------------------------------------------------
  let centralPolygons: OverlayPoint[][] = [];

  if (!isPartial) {
    const cenOutlines: { t: number; points: OverlayPoint[] }[] = [];

    for (let t = T_MIN; t <= T_MAX + 1e-9; t += TIME_STEP_CENTRAL) {
      const center = shadowAxisLatLon(e, t);
      if (!center) continue;

      const cVal = umbraMetric(
        e,
        { latDeg: center[0], lonDeg: center[1], elevM: 0 },
        t
      );
      if (cVal >= 0) continue;

      const outline = traceOutlineAtTime(
        e,
        t,
        center[0],
        center[1],
        UMB_SEARCH_DEG,
        umbraMetric,
        BEARING_SAMPLES_CENTRAL
      );
      if (outline.length >= 3) {
        cenOutlines.push({ t, points: outline });
      }
    }

    centralPolygons = buildBandPolygon(cenOutlines, SIMPLIFY_CEN_DEG);
  }

  return {
    overlayVisiblePolygons: visiblePolygons,
    overlayCentralPolygons: centralPolygons,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

console.log("Loading catalog...");
const raw = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as any[];
const catalog: EclipseRecord[] = raw.map((e: any) => {
  const { overlayVisiblePolygons, overlayCentralPolygons, ...rest } = e;
  return rest as EclipseRecord;
});

console.log(`Building overlays for ${catalog.length} eclipses...`);
const overlays: Record<string, OverlayResult> = {};
let doneCount = 0;

for (const e of catalog) {
  const result = buildOverlaysForEclipse(e);
  overlays[e.id] = result;
  doneCount++;
  if (doneCount % 10 === 0 || doneCount === catalog.length) {
    console.log(
      `  [${doneCount}/${catalog.length}] ${e.id} — vis: ${result.overlayVisiblePolygons.length} poly, cen: ${result.overlayCentralPolygons.length} poly`
    );
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(overlays, null, 0), "utf8");

const byDecade = new Map<number, Record<string, OverlayResult>>();
for (const [id, overlay] of Object.entries(overlays)) {
  const year = Number(id.slice(0, 4));
  if (!Number.isFinite(year)) continue;
  const decade = Math.floor(year / 10) * 10;
  const existing = byDecade.get(decade);
  if (existing) {
    existing[id] = overlay;
  } else {
    byDecade.set(decade, { [id]: overlay });
  }
}

for (const [decade, entries] of [...byDecade.entries()].sort((a, b) => a[0] - b[0])) {
  fs.writeFileSync(outChunkPath(decade), JSON.stringify(entries, null, 0), "utf8");
}

const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
console.log(`\nWrote ${outPath} (${sizeKb} KB, ${catalog.length} eclipses)`);
console.log(`Wrote ${byDecade.size} decade chunk files for lazy overlay loading.`);
