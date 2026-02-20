import { useEffect } from "react";

import {
  cancelManagedScheduledNotificationsAsync,
  type ManagedEclipseReminderEntry,
  type NotificationSchedulingSettings,
  rescheduleManagedEclipseReminderEntriesAsync,
} from "../services/notifications";
import type { EclipseReminderAnchor, NotificationSettings } from "../state/appState";

function toSchedulingSettings(settings: NotificationSettings): NotificationSchedulingSettings {
  return {
    vibrationEnabled: settings.vibrationEnabled,
    soundEnabled: settings.soundEnabled,
    useTtsVoice: settings.useTtsVoice,
    remindOneHourBefore: settings.remindOneHourBefore,
    remindTenMinutesBefore: settings.remindTenMinutesBefore,
  };
}

function toSchedulableEntries(
  anchors: EclipseReminderAnchor[],
  disabledEclipseAlarmIds: string[],
): ManagedEclipseReminderEntry[] {
  const disabledSet = new Set(disabledEclipseAlarmIds.map((id) => id.trim()).filter(Boolean));
  const deduped = new Map<string, ManagedEclipseReminderEntry>();

  for (const anchor of anchors) {
    if (disabledSet.has(anchor.eclipseId)) continue;
    deduped.set(anchor.id, {
      id: anchor.id,
      eclipseId: anchor.eclipseId,
      eclipseDateYmd: anchor.eclipseDateYmd,
      eclipseLabel: anchor.eclipseLabel,
      firstEventIso: anchor.firstEventIso,
    });
  }

  return [...deduped.values()];
}

export function useNotificationScheduler(
  settings: NotificationSettings,
  eclipseReminderAnchors: EclipseReminderAnchor[],
  disabledEclipseAlarmIds: string[],
) {
  useEffect(() => {
    let didCancel = false;

    const sync = async () => {
      const entries = toSchedulableEntries(eclipseReminderAnchors, disabledEclipseAlarmIds);

      if (!entries.length || (!settings.remindOneHourBefore && !settings.remindTenMinutesBefore)) {
        await cancelManagedScheduledNotificationsAsync();
        return;
      }

      const outcome = await rescheduleManagedEclipseReminderEntriesAsync({
        settings: toSchedulingSettings(settings),
        entries,
      });

      if (didCancel) return;
      if (!outcome.permissionGranted) {
        console.warn("Notification permission denied while syncing eclipse reminders.");
      }
    };

    void sync();

    return () => {
      didCancel = true;
    };
  }, [disabledEclipseAlarmIds, eclipseReminderAnchors, settings]);
}
