import type { EclipseRecord } from "@eclipse-timer/shared";

export function t0TtDate(e: EclipseRecord): Date {
  const [yRaw = "", mRaw = "", dRaw = ""] = e.dateYmd.split("-");
  const Y = Number(yRaw);
  const M = Number(mRaw);
  const D = Number(dRaw);

  const totalSeconds = e.t0TtHours * 3600;
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds - hh * 3600) / 60);
  const ss = totalSeconds - hh * 3600 - mm * 60;

  const sInt = Math.floor(ss);
  const ms = Math.round((ss - sInt) * 1000);

  return new Date(Date.UTC(Y, M - 1, D, hh, mm, sInt, ms));
}

export function ttAtTHours(e: EclipseRecord, tHoursFromT0: number): Date {
  const t0 = t0TtDate(e);
  return new Date(t0.getTime() + tHoursFromT0 * 3600_000);
}
