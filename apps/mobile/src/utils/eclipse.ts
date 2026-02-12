import type { EclipseRecord } from "@eclipse-timer/shared";

import { MONTHS_SHORT } from "./date";

export function kindCodeForRecord(e: EclipseRecord): "T" | "A" | "H" | "P" {
  const rawKind = String((e as any).kind ?? "").toUpperCase();
  const fromKind = rawKind[0];
  if (fromKind === "T" || fromKind === "A" || fromKind === "H" || fromKind === "P") return fromKind;

  const idSuffix = e.id.match(/[A-Za-z]+$/)?.[0]?.toUpperCase();
  const fromId = idSuffix?.[0];
  if (fromId === "T" || fromId === "A" || fromId === "H" || fromId === "P") return fromId;
  return "P";
}

export function kindLabelFromCode(code: "T" | "A" | "H" | "P") {
  if (code === "T") return "Total Solar Eclipse";
  if (code === "A") return "Annular Solar Eclipse";
  if (code === "H") return "Hybrid Solar Eclipse";
  return "Partial Solar Eclipse";
}

export function nasaGifUrlForRecord(e: EclipseRecord) {
  const [yyyy = "2001", mm = "01", dd = "01"] = e.dateYmd.split("-");
  const monthIndex = Number(mm) - 1;
  const month = MONTHS_SHORT[monthIndex] ?? "Jan";
  const yearNum = Number(yyyy);
  const blockStartYear = Number.isFinite(yearNum) ? Math.floor((yearNum - 1) / 100) * 100 + 1 : 2001;
  const kindCode = kindCodeForRecord(e);
  return `https://eclipse.gsfc.nasa.gov/SEanimate/SEanimate${blockStartYear}/SE${yyyy}${month}${dd}${kindCode}.GIF`;
}

export function eclipseCenterForRecord(e: EclipseRecord | null): { lat: number; lon: number } | null {
  if (!e) return null;
  const lat = e.greatestEclipseLatDeg;
  const lon = e.greatestEclipseLonDeg;
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lon !== "number" || !Number.isFinite(lon)) return null;
  return { lat, lon };
}
