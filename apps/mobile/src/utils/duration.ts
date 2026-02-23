export function formatTimerDuration(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "--";

  const totalSeconds = Math.round(seconds);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;

  if (totalMinutes > 60) {
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  return `${totalMinutes}m ${String(ss).padStart(2, "0")}s`;
}
