import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import type { EclipseRecord } from "@eclipse-timer/shared";
import { evaluateAtT } from "../../engine/src/circumstances/functions.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inPath = path.resolve(__dirname, "../generated/eclipse_besselian_1900_2100.csv");
const outPath = path.resolve(__dirname, "../generated/catalog.generated.json");

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const normalizeLongitude = (lonDeg: number) => {
  let lon = lonDeg;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
};

type OverlayPoint = [number, number]; // [lat, lon]
type OverlayPolygon = OverlayPoint[];
type GridVertex = { r: number; c: number };
type GridEdge = { a: GridVertex; b: GridVertex; aId: string; bId: string };

type EclipseKind = "T" | "A" | "P" | "H";

const OVERLAY_ROWS = clamp(Math.round(toNum(process.env.OVERLAY_ROWS ?? 18)), 8, 64);
const OVERLAY_COLS = clamp(Math.round(toNum(process.env.OVERLAY_COLS ?? 36)), 16, 128);
const COARSE_STEP_H = Math.max(0.25, toNum(process.env.OVERLAY_COARSE_STEP_H ?? 0.5));
const FINE_STEP_H = Math.max(0.05, toNum(process.env.OVERLAY_FINE_STEP_H ?? 0.1));
const FINE_WINDOW_H = Math.max(0.2, toNum(process.env.OVERLAY_FINE_WINDOW_H ?? 0.5));

const gridVertexId = (v: GridVertex) => `${v.r}:${v.c}`;

function simplifyGridLoop(loop: GridVertex[]): GridVertex[] {
  if (loop.length < 4) return loop;
  const out: GridVertex[] = [];
  for (let i = 0; i < loop.length; i++) {
    const prev = loop[(i - 1 + loop.length) % loop.length]!;
    const cur = loop[i]!;
    const next = loop[(i + 1) % loop.length]!;
    const dr1 = cur.r - prev.r;
    const dc1 = cur.c - prev.c;
    const dr2 = next.r - cur.r;
    const dc2 = next.c - cur.c;
    if (dr1 === dr2 && dc1 === dc2) continue;
    out.push(cur);
  }
  return out;
}

function polygonAreaDeg2(poly: OverlayPolygon): number {
  if (poly.length < 3) return 0;
  let area2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    area2 += a[1] * b[0] - b[1] * a[0];
  }
  return Math.abs(area2) * 0.5;
}

function unwrapLongitudes(poly: OverlayPolygon): OverlayPolygon {
  if (!poly.length) return [];
  const out: OverlayPolygon = [[poly[0]![0], poly[0]![1]]];
  let prevLon = poly[0]![1];
  for (let i = 1; i < poly.length; i++) {
    const [lat, rawLon] = poly[i]!;
    let lon = rawLon;
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    out.push([lat, lon]);
    prevLon = lon;
  }
  return out;
}

function smoothClosedPolygon(poly: OverlayPolygon, iterations = 1): OverlayPolygon {
  if (poly.length < 4) return poly;
  let work = unwrapLongitudes(poly);
  for (let it = 0; it < iterations; it++) {
    if (work.length < 4) break;
    const next: OverlayPolygon = [];
    for (let i = 0; i < work.length; i++) {
      const a = work[i]!;
      const b = work[(i + 1) % work.length]!;
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    work = next;
  }
  return work.map(([lat, lon]) => [clamp(lat, -89.9, 89.9), normalizeLongitude(lon)]);
}

function contourPolygonsFromMask(
  mask: boolean[][],
  latNorth: number,
  lonWest: number,
  latStep: number,
  lonStep: number
): OverlayPolygon[] {
  const rows = mask.length;
  const cols = rows ? mask[0]!.length : 0;
  if (!rows || !cols) return [];

  const edges: GridEdge[] = [];
  const addEdge = (a: GridVertex, b: GridVertex) =>
    edges.push({ a, b, aId: gridVertexId(a), bId: gridVertexId(b) });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r]![c]) continue;
      if (r === 0 || !mask[r - 1]![c]) addEdge({ r, c }, { r, c: c + 1 });
      if (c === cols - 1 || !mask[r]![c + 1]) addEdge({ r, c: c + 1 }, { r: r + 1, c: c + 1 });
      if (r === rows - 1 || !mask[r + 1]![c]) addEdge({ r: r + 1, c: c + 1 }, { r: r + 1, c });
      if (c === 0 || !mask[r]![c - 1]) addEdge({ r: r + 1, c }, { r, c });
    }
  }

  if (!edges.length) return [];

  const starts = new Map<string, number[]>();
  edges.forEach((edge, idx) => {
    const list = starts.get(edge.aId);
    if (list) list.push(idx);
    else starts.set(edge.aId, [idx]);
  });

  const used = new Set<number>();
  const loops: GridVertex[][] = [];

  for (let i = 0; i < edges.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const first = edges[i]!;
    const startId = first.aId;
    let endId = first.bId;
    const loop: GridVertex[] = [first.a, first.b];
    let guard = 0;

    while (endId !== startId && guard < edges.length + 8) {
      const candidates = starts.get(endId) ?? [];
      const nextIdx = candidates.find((idx) => !used.has(idx));
      if (nextIdx == null) break;
      const next = edges[nextIdx]!;
      used.add(nextIdx);
      loop.push(next.b);
      endId = next.bId;
      guard++;
    }

    if (endId === startId && loop.length >= 4) {
      loop.pop();
      loops.push(simplifyGridLoop(loop));
    }
  }

  return loops
    .map((loop) =>
      loop.map((v) => [
        clamp(latNorth - v.r * latStep, -89.9, 89.9),
        normalizeLongitude(lonWest + v.c * lonStep),
      ] as OverlayPoint)
    )
    .map((poly) => smoothClosedPolygon(poly, 1))
    .filter((poly) => poly.length >= 3 && polygonAreaDeg2(poly) > 0.01);
}

function classifyLocationFast(e: EclipseRecord, lat: number, lon: number, includeCentral: boolean): { visible: boolean; central: boolean } {
  const observer = { latDeg: lat, lonDeg: lon, elevM: 0 };
  let bestPen = Number.POSITIVE_INFINITY;
  let bestPenT = 0;
  let bestUmb = Number.POSITIVE_INFINITY;
  let bestUmbT = 0;

  for (let t = -3; t <= 3 + 1e-9; t += COARSE_STEP_H) {
    const v = evaluateAtT(e, observer, t);
    const pen = v.delta - v.L1obs;
    if (Number.isFinite(pen) && pen < bestPen) {
      bestPen = pen;
      bestPenT = t;
    }

    if (includeCentral) {
      const umb = v.delta - Math.abs(v.L2obs);
      if (Number.isFinite(umb) && umb < bestUmb) {
        bestUmb = umb;
        bestUmbT = t;
      }
    }
  }

  const penLo = Math.max(-3, bestPenT - FINE_WINDOW_H);
  const penHi = Math.min(3, bestPenT + FINE_WINDOW_H);
  for (let t = penLo; t <= penHi + 1e-9; t += FINE_STEP_H) {
    const v = evaluateAtT(e, observer, t);
    const pen = v.delta - v.L1obs;
    if (Number.isFinite(pen) && pen < bestPen) bestPen = pen;
  }

  if (includeCentral) {
    const umbLo = Math.max(-3, bestUmbT - FINE_WINDOW_H);
    const umbHi = Math.min(3, bestUmbT + FINE_WINDOW_H);
    for (let t = umbLo; t <= umbHi + 1e-9; t += FINE_STEP_H) {
      const v = evaluateAtT(e, observer, t);
      const umb = v.delta - Math.abs(v.L2obs);
      if (Number.isFinite(umb) && umb < bestUmb) bestUmb = umb;
    }
  }

  const visible = bestPen <= 0;
  const central = includeCentral && bestUmb <= 0;
  return { visible, central };
}

function buildOverlayPolygons(e: EclipseRecord): {
  overlayVisiblePolygons: OverlayPolygon[];
  overlayCentralPolygons: OverlayPolygon[];
} {
  const latNorth = 85;
  const latSouth = -85;
  const lonWest = -180;
  const lonEast = 180;

  const rows = OVERLAY_ROWS;
  const cols = OVERLAY_COLS;
  const latStep = (latNorth - latSouth) / rows;
  const lonStep = (lonEast - lonWest) / cols;
  const includeCentral = String((e as any).kind ?? "").toUpperCase()[0] !== "P";

  const visibleMask: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
  const centralMask: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );

  for (let r = 0; r < rows; r++) {
    const lat = latNorth - (r + 0.5) * latStep;
    for (let c = 0; c < cols; c++) {
      const lon = lonWest + (c + 0.5) * lonStep;
      const out = classifyLocationFast(e, lat, lon, includeCentral);
      if (out.visible) {
        visibleMask[r]![c] = true;
        if (out.central) centralMask[r]![c] = true;
      }
    }
  }

  return {
    overlayVisiblePolygons: contourPolygonsFromMask(visibleMask, latNorth, lonWest, latStep, lonStep),
    overlayCentralPolygons: contourPolygonsFromMask(centralMask, latNorth, lonWest, latStep, lonStep),
  };
}

const text = fs.readFileSync(inPath, "utf8");
const rows: Record<string, string>[] = parse(text, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const catalog = rows.map((r) => {
  const year = toNum(r.year);
  const month = toNum(r.month);
  const day = toNum(r.day);

  const ymd = `${year}-${pad2(month)}-${pad2(day)}`;

  const id = `${ymd}T`;

  const kind = (String(r.eclipse_type || r.etype || "P").trim() as EclipseKind);
  const greatestEclipseLatDeg = toNum(r.lat_dd_ge);
  const greatestEclipseLonDeg = toNum(r.lng_dd_ge);

  const record = {
    id,
    dateYmd: ymd,
    kind,

    // EXACT field names matching EclipseRecord
    t0TtHours: toNum(r.t0),
    deltaTSeconds: toNum(r.dt),

    tanF1: toNum(r.tan_f1),
    tanF2: toNum(r.tan_f2),

    x: [toNum(r.x0), toNum(r.x1), toNum(r.x2), toNum(r.x3)],
    y: [toNum(r.y0), toNum(r.y1), toNum(r.y2), toNum(r.y3)],
    d: [toNum(r.d0), toNum(r.d1), toNum(r.d2)],
    mu: [toNum(r.mu0), toNum(r.mu1), toNum(r.mu2)],
    l1: [toNum(r.l10), toNum(r.l11), toNum(r.l12)],
    l2: [toNum(r.l20), toNum(r.l21), toNum(r.l22)],

    // optional
    greatestEclipseUtc: undefined,
    greatestDurationUtc: undefined,
    greatestEclipseLatDeg: Number.isFinite(greatestEclipseLatDeg) ? greatestEclipseLatDeg : undefined,
    greatestEclipseLonDeg: Number.isFinite(greatestEclipseLonDeg) ? greatestEclipseLonDeg : undefined,
  };

  return record;
});

// Drop rows with missing core numeric data
const cleaned = catalog.filter((e) => {
  const nums = [
    e.t0TtHours,
    e.deltaTSeconds,
    e.tanF1,
    e.tanF2,
    ...e.x,
    ...e.y,
    ...e.d,
    ...e.mu,
    ...e.l1,
    ...e.l2,
  ];
  return nums.every((n) => Number.isFinite(n));
});

const withOverlays = cleaned.map((e, idx) => {
  const overlay = buildOverlayPolygons(e as EclipseRecord);
  if ((idx + 1) % 10 === 0 || idx === cleaned.length - 1) {
    console.log(`Overlay ${idx + 1}/${cleaned.length} built (${e.id})`);
  }
  return {
    ...e,
    ...overlay,
  };
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(withOverlays, null, 0), "utf8");

console.log(
  `Wrote ${withOverlays.length} eclipses with overlays (${OVERLAY_ROWS}x${OVERLAY_COLS}, coarse=${COARSE_STEP_H}h, fine=${FINE_STEP_H}h) -> ${outPath}`
);
