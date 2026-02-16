export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function localYmdNow() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fmtUtcHuman(iso?: string) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--";
  const yyyy = d.getUTCFullYear();
  const mon = MONTHS_SHORT[d.getUTCMonth()];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mon} ${dd}, ${yyyy} ${hh}:${mm}:${ss} UTC`;
}

function localUtcOffsetLabel(d: Date) {
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

export function fmtLocalHuman(iso?: string) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "--";

  const yyyy = d.getFullYear();
  const mon = MONTHS_SHORT[d.getMonth()] ?? "Jan";
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${mon} ${dd}, ${yyyy} ${hh}:${mm}:${ss} ${localUtcOffsetLabel(d)}`;
}
