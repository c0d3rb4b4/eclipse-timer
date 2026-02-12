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
