export type ReminderScheduleSettings = {
  remindOneHourBefore: boolean;
  remindTenMinutesBefore: boolean;
};

export type ReminderScheduleEntry = {
  id: string;
  firstEventIso: string;
};

export type ReminderScheduleRequest<TEntry extends ReminderScheduleEntry = ReminderScheduleEntry> =
  {
    entry: TEntry;
    leadMinutes: number;
    fireDate: Date;
  };

export function enabledReminderMinutes(settings: ReminderScheduleSettings) {
  const minutes: number[] = [];
  if (settings.remindOneHourBefore) minutes.push(60);
  if (settings.remindTenMinutesBefore) minutes.push(10);
  return minutes;
}

export function reminderLeadLabel(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}

function parseDateIso(iso?: string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date;
}

export function buildReminderScheduleRequests<TEntry extends ReminderScheduleEntry>(
  settings: ReminderScheduleSettings,
  entries: TEntry[],
  nowMs = Date.now(),
): {
  requests: ReminderScheduleRequest<TEntry>[];
  skippedPastCount: number;
} {
  const reminderMinutes = enabledReminderMinutes(settings);
  const deduped = new Map<string, TEntry>();
  for (const entry of entries) {
    deduped.set(entry.id, entry);
  }

  const requests: ReminderScheduleRequest<TEntry>[] = [];
  let skippedPastCount = 0;

  for (const entry of deduped.values()) {
    const firstEventDate = parseDateIso(entry.firstEventIso);
    if (!firstEventDate) {
      skippedPastCount += reminderMinutes.length;
      continue;
    }

    for (const minutes of reminderMinutes) {
      const fireDate = new Date(firstEventDate.getTime() - minutes * 60 * 1000);
      if (fireDate.getTime() <= nowMs) {
        skippedPastCount += 1;
        continue;
      }

      requests.push({
        entry,
        leadMinutes: minutes,
        fireDate,
      });
    }
  }

  return {
    requests,
    skippedPastCount,
  };
}
