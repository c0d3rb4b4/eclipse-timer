import { useEffect } from "react";

import {
  cancelManagedScheduledNotificationsAsync,
  rescheduleManagedNotificationEntriesAsync,
  type NotificationSchedulingSettings,
} from "../services/notifications";
import type { NotificationEntry, NotificationSettings } from "../state/appState";

function toSchedulingSettings(settings: NotificationSettings): NotificationSchedulingSettings {
  return {
    countdownAlerts: settings.countdownAlerts,
    vibrationEnabled: settings.vibrationEnabled,
    soundEnabled: settings.soundEnabled,
    useTtsVoice: settings.useTtsVoice,
    remindOneHourBefore: settings.remindOneHourBefore,
    remindTenMinutesBefore: settings.remindTenMinutesBefore,
  };
}

function toSchedulableEntries(entries: NotificationEntry[]) {
  const deduped = new Map<string, NotificationEntry>();
  for (const entry of entries) {
    deduped.set(entry.id, entry);
  }

  return [...deduped.values()].map((entry) => ({
    id: entry.id,
    eclipseId: entry.eclipseId,
    eclipseDateYmd: entry.eclipseDateYmd,
    contactKey: entry.contactKey,
    contactLabel: entry.contactLabel,
    iso: entry.iso,
  }));
}

export function useNotificationScheduler(
  settings: NotificationSettings,
  notificationEntries: NotificationEntry[],
) {
  useEffect(() => {
    let didCancel = false;

    const sync = async () => {
      if (!settings.eclipseAlerts) {
        await cancelManagedScheduledNotificationsAsync();
        return;
      }

      const outcome = await rescheduleManagedNotificationEntriesAsync({
        settings: toSchedulingSettings(settings),
        entries: toSchedulableEntries(notificationEntries),
      });

      if (didCancel) return;
      if (!outcome.permissionGranted) {
        // Keep this non-blocking for now; notification settings UI will surface failures on test.
        console.warn("Notification permission denied while syncing scheduled notifications.");
      }
    };

    void sync();

    return () => {
      didCancel = true;
    };
  }, [notificationEntries, settings]);
}
