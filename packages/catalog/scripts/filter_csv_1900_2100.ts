import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inPath = path.resolve(__dirname, "../raw/eclipse_besselian_from_mysqldump2.csv");
const outPath = path.resolve(__dirname, "../generated/eclipse_besselian_1900_2100.csv");

const text = fs.readFileSync(inPath, "utf8");

// Parse with header row
const records: Record<string, string>[] = parse(text, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

// Filter years
const filtered = records.filter((r) => {
  const y = Number(r.year);
  return Number.isFinite(y) && y >= 1900 && y <= 2100;
});

// Write back as CSV with same columns order
const header = Object.keys(records[0] ?? {});
const lines = [
  header.map((h) => `"${h}"`).join(","),
  ...filtered.map((r) => header.map((h) => String(r[h] ?? "")).join(",")),
];

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n"), "utf8");

console.log(`Wrote ${filtered.length} rows -> ${outPath}`);
