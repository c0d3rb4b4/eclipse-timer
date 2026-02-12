import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inPath = path.resolve(__dirname, "../generated/eclipse_besselian_1900_2100.csv");
const outPath = path.resolve(__dirname, "../generated/catalog.generated.json");

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

type EclipseKind = "T" | "A" | "P" | "H";

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

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(cleaned, null, 0), "utf8");

console.log(`Wrote ${cleaned.length} eclipses -> ${outPath}`);
