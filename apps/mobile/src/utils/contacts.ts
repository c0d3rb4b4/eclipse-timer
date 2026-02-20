import type { Circumstances } from "@eclipse-timer/shared";
import type { NotificationMockTimeline } from "../state/appState";

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

export function applyMockContactTimeline(
  items: ContactItem[],
  mockTimeline: NotificationMockTimeline,
  anchorNowMs = Date.now(),
) {
  if (!mockTimeline.enabled || !items.length) return items;

  const safeAnchorMs = Number.isFinite(anchorNowMs) ? anchorNowMs : Date.now();
  const firstContactOffsetMs =
    Math.max(1, Math.round(mockTimeline.firstContactOffsetMinutes)) * 60 * 1000;
  const subsequentContactGapMs =
    Math.max(1, Math.round(mockTimeline.subsequentContactGapMinutes)) * 60 * 1000;

  let nextContactMs = safeAnchorMs + firstContactOffsetMs;

  return items.map((item) => {
    if (!item.iso) return item;

    const mockIso = new Date(nextContactMs).toISOString();
    nextContactMs += subsequentContactGapMs;

    return {
      ...item,
      iso: mockIso,
    };
  });
}

export function nextEventCountdownFromItems(items: ContactItem[], nowMs = Date.now()) {
  const events = items
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

export function nextEventCountdown(c: Circumstances, nowMs = Date.now()) {
  return nextEventCountdownFromItems(buildContactItems(c), nowMs);
}
