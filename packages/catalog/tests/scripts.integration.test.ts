import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { parse } from "csv-parse/sync";
import generatedCatalog from "../generated/catalog.generated.json";
import overlays from "../generated/overlays.generated.json";

type CsvRow = Record<string, string>;
type CatalogRecord = {
  id: string;
  dateYmd: string;
  kind: string;
  t0TtHours: number;
  deltaTSeconds: number;
  tanF1: number;
  tanF2: number;
  x: number[];
  y: number[];
  d: number[];
  mu: number[];
  l1: number[];
  l2: number[];
  greatestEclipseLatDeg?: number;
  greatestEclipseLonDeg?: number;
};

function toNum(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function readCsvRows(pathname: string): CsvRow[] {
  const text = fs.readFileSync(pathname, "utf8");
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
}

function sha256(pathname: string): string {
  const bytes = fs.readFileSync(pathname);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const filteredCsvPath = new URL("../generated/eclipse_besselian_1900_2100.csv", import.meta.url)
  .pathname;
const catalogPath = new URL("../generated/catalog.generated.json", import.meta.url).pathname;
const overlaysPath = new URL("../generated/overlays.generated.json", import.meta.url).pathname;

describe("catalog scripts integration outputs", () => {
  it("keeps filtered CSV inside the 1900-2100 range", () => {
    const rows = readCsvRows(filteredCsvPath);
    expect(rows).toHaveLength(454);

    const years = rows.map((r) => Number(r.year));
    expect(Math.min(...years)).toBe(1900);
    expect(Math.max(...years)).toBe(2100);
    expect(years.every((y) => Number.isFinite(y) && y >= 1900 && y <= 2100)).toBe(true);
  });

  it("keeps catalog.generated.json mapped correctly from filtered CSV columns", () => {
    const rows = readCsvRows(filteredCsvPath);
    const catalog = generatedCatalog as CatalogRecord[];
    const byId = new Map(catalog.map((e) => [e.id, e]));
    expect(byId.size).toBe(rows.length);

    for (const r of rows) {
      const year = toNum(r.year);
      const month = toNum(r.month);
      const day = toNum(r.day);
      const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
      const id = `${ymd}T`;
      const rec = byId.get(id);
      expect(rec, `${id} should exist in generated catalog`).toBeDefined();
      if (!rec) continue;

      const expectedKind = String(r.eclipse_type || r.etype || "P").trim();
      expect(rec.dateYmd).toBe(ymd);
      expect(rec.kind).toBe(expectedKind);

      expect(rec.t0TtHours).toBe(toNum(r.t0));
      expect(rec.deltaTSeconds).toBe(toNum(r.dt));
      expect(rec.tanF1).toBe(toNum(r.tan_f1));
      expect(rec.tanF2).toBe(toNum(r.tan_f2));
      expect(rec.x).toEqual([toNum(r.x0), toNum(r.x1), toNum(r.x2), toNum(r.x3)]);
      expect(rec.y).toEqual([toNum(r.y0), toNum(r.y1), toNum(r.y2), toNum(r.y3)]);
      expect(rec.d).toEqual([toNum(r.d0), toNum(r.d1), toNum(r.d2)]);
      expect(rec.mu).toEqual([toNum(r.mu0), toNum(r.mu1), toNum(r.mu2)]);
      expect(rec.l1).toEqual([toNum(r.l10), toNum(r.l11), toNum(r.l12)]);
      expect(rec.l2).toEqual([toNum(r.l20), toNum(r.l21), toNum(r.l22)]);

      const lat = toNum(r.lat_dd_ge);
      const lon = toNum(r.lng_dd_ge);
      if (Number.isFinite(lat)) expect(rec.greatestEclipseLatDeg).toBe(lat);
      else expect(rec.greatestEclipseLatDeg).toBeUndefined();
      if (Number.isFinite(lon)) expect(rec.greatestEclipseLonDeg).toBe(lon);
      else expect(rec.greatestEclipseLonDeg).toBeUndefined();
    }
  });

  it("keeps overlay output keyed by catalog ids with finite coordinate points", () => {
    const catalogIds = new Set((generatedCatalog as CatalogRecord[]).map((e) => e.id));
    const overlayEntries = overlays as Record<
      string,
      { overlayVisiblePolygons: [number, number][][]; overlayCentralPolygons: [number, number][][] }
    >;

    const overlayIds = Object.keys(overlayEntries);
    expect(overlayIds.length).toBe(catalogIds.size);
    for (const id of overlayIds) {
      expect(catalogIds.has(id), `${id} must exist in catalog`).toBe(true);
      const entry = overlayEntries[id];
      expect(entry, `${id} overlay entry must be defined`).toBeDefined();
      if (!entry) continue;
      expect(Array.isArray(entry.overlayVisiblePolygons)).toBe(true);
      expect(Array.isArray(entry.overlayCentralPolygons)).toBe(true);

      for (const poly of [...entry.overlayVisiblePolygons, ...entry.overlayCentralPolygons]) {
        for (const point of poly) {
          const [lat, lon] = point;
          expect(Number.isFinite(lat)).toBe(true);
          expect(Number.isFinite(lon)).toBe(true);
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
          expect(lon).toBeGreaterThanOrEqual(-180);
          expect(lon).toBeLessThanOrEqual(180);
        }
      }
    }
  });

  it("keeps generated artifact snapshots stable", () => {
    expect(sha256(filteredCsvPath)).toBe(
      "f9ff6b47bfc82be42e019b3560f369e827da8f71651eea7ffc962e4a90021883",
    );
    expect(sha256(catalogPath)).toBe(
      "80ce7678d77111d542c5a330485863402aaad3b6b2bb81d5de31274893df4e19",
    );
    expect(sha256(overlaysPath)).toBe(
      "64c5ab99c04b5546c141b4f8a1395a5cfe048fcd7c0942983c618ca1827e870b",
    );
  });
});
