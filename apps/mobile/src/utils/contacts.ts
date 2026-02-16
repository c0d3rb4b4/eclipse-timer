import type { Circumstances } from "@eclipse-timer/shared";

export type ContactKey = "c1" | "c2" | "max" | "c3" | "c4";

export type ContactItem = {
  key: ContactKey;
  label: string;
  iso?: string;
};

export function buildContactItems(c: Circumstances): ContactItem[] {
  if (c.kindAtLocation === "total") {
    return [
      { key: "c1", label: "Partial Eclipse Starts (C1)", iso: c.c1Utc },
      { key: "c2", label: "Totality Starts (C2)", iso: c.c2Utc },
      { key: "max", label: "Maximum Eclipse", iso: c.maxUtc },
      { key: "c3", label: "Totality Ends (C3)", iso: c.c3Utc },
      { key: "c4", label: "Partial Eclipse Ends (C4)", iso: c.c4Utc },
    ];
  }

  return [
    { key: "c1", label: "First Contact (C1)", iso: c.c1Utc },
    { key: "c2", label: "Second Contact (C2)", iso: c.c2Utc },
    { key: "max", label: "Maximum Eclipse", iso: c.maxUtc },
    { key: "c3", label: "Third Contact (C3)", iso: c.c3Utc },
    { key: "c4", label: "Fourth Contact (C4)", iso: c.c4Utc },
  ];
}

export function nextEventCountdown(c: Circumstances, nowMs = Date.now()) {
  const events = buildContactItems(c)
    .map((item) => {
      if (!item.iso) return null;
      const t = Date.parse(item.iso);
      if (!Number.isFinite(t)) return null;
      return { key: item.key, t };
    })
    .filter((e): e is { key: ContactKey; t: number } => !!e);

  const future = events.filter((e) => e.t > nowMs).sort((a, b) => a.t - b.t)[0];
  if (!future) return "No upcoming contact time (for this eclipse)";

  const diffSec = Math.max(0, Math.floor((future.t - nowMs) / 1000));
  const dd = Math.floor(diffSec / 86400);
  const hh = Math.floor((diffSec % 86400) / 3600);
  const mm = Math.floor((diffSec % 3600) / 60);
  const ss = diffSec % 60;
  const eventLabel = future.key === "max" ? "MAX" : future.key.toUpperCase();

  return `${eventLabel} in ${dd}d ${hh}h ${mm}m ${ss}s`;
}
