import { Platform } from "react-native";
import getAllScheduledNotificationsAsync from "expo-notifications/build/getAllScheduledNotificationsAsync";
import cancelScheduledNotificationAsync from "expo-notifications/build/cancelScheduledNotificationAsync";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-notifications/build/NotificationPermissions";
import setNotificationChannelAsync from "expo-notifications/build/setNotificationChannelAsync";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import {
  SchedulableTriggerInputTypes,
  type DateTriggerInput,
  type NotificationContentInput,
  type NotificationRequest,
} from "expo-notifications/build/Notifications.types";

const MANAGED_NOTIFICATION_SOURCE = "eclipse-timer";
const ANDROID_CHANNEL_ID = "eclipse-alerts";

let hasConfiguredHandler = false;

export type NotificationSchedulingSettings = {
  countdownAlerts: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  useTtsVoice: boolean;
  remindOneHourBefore: boolean;
  remindTenMinutesBefore: boolean;
};

export type NotificationContact = {
  key: string;
  label: string;
  iso?: string;
  enabled: boolean;
};

export type RescheduleNotificationsInput = {
  eclipseId: string;
  eclipseDateYmd: string;
  settings: NotificationSchedulingSettings;
  contacts: NotificationContact[];
};

export type ManagedNotificationEntry = {
  id: string;
  eclipseId: string;
  eclipseDateYmd: string;
  contactKey: string;
  contactLabel: string;
  iso: string;
};

export type RescheduleManagedNotificationsInput = {
  settings: NotificationSchedulingSettings;
  entries: ManagedNotificationEntry[];
};

export type RescheduleNotificationsResult = {
  permissionGranted: boolean;
  scheduledCount: number;
  skippedPastCount: number;
};

export type TestNotificationResult =
  | {
      ok: true;
      fireDate: Date;
    }
  | {
      ok: false;
      reason: "permission_denied" | "schedule_failed";
    };

function managedNotificationData(extra: Record<string, unknown>) {
  return {
    source: MANAGED_NOTIFICATION_SOURCE,
    ...extra,
  };
}

function buildDateTrigger(date: Date): DateTriggerInput {
  const trigger: DateTriggerInput = {
    type: SchedulableTriggerInputTypes.DATE,
    date,
  };

  if (Platform.OS === "android") {
    trigger.channelId = ANDROID_CHANNEL_ID;
  }

  return trigger;
}

function createNotificationContent(
  title: string,
  body: string,
  settings: NotificationSchedulingSettings,
  data: Record<string, unknown>,
): NotificationContentInput {
  const audioMode = settings.useTtsVoice ? "tts" : "system";
  const content: NotificationContentInput = {
    title,
    body,
    data: managedNotificationData({
      ...data,
      audioMode,
    }),
    sound: settings.useTtsVoice ? false : settings.soundEnabled ? "default" : false,
  };

  if (Platform.OS === "android") {
    content.vibrate = settings.vibrationEnabled ? [0, 250, 120, 250] : [];
  }

  return content;
}

function getEnabledReminderMinutes(settings: NotificationSchedulingSettings) {
  const minutes: number[] = [];
  if (settings.remindOneHourBefore) minutes.push(60);
  if (settings.remindTenMinutesBefore) minutes.push(10);
  return minutes;
}

function reminderLabel(minutes: number) {
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

function isManagedRequest(request: NotificationRequest) {
  return request.content.data?.source === MANAGED_NOTIFICATION_SOURCE;
}

async function configureAndroidChannel(settings: NotificationSchedulingSettings) {
  if (Platform.OS !== "android") return;

  await setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Eclipse Alerts",
    importance: AndroidImportance.HIGH,
    enableVibrate: settings.vibrationEnabled,
    vibrationPattern: settings.vibrationEnabled ? [0, 250, 120, 250] : [],
    sound: settings.useTtsVoice ? null : settings.soundEnabled ? "default" : null,
  });
}

export function configureNotificationPresentationHandler() {
  if (hasConfiguredHandler) return;

  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  hasConfiguredHandler = true;
}

export async function ensureNotificationPermissionAsync() {
  const current = await getPermissionsAsync();
  if (current.granted || current.status === "granted") return true;

  const requested = await requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return requested.granted || requested.status === "granted";
}

export async function cancelManagedScheduledNotificationsAsync() {
  const scheduled = await getAllScheduledNotificationsAsync();
  const managedIds = scheduled.filter(isManagedRequest).map((request) => request.identifier);
  await Promise.all(
    managedIds.map((identifier) =>
      cancelScheduledNotificationAsync(identifier).catch(() => undefined),
    ),
  );
}

export async function rescheduleManagedNotificationEntriesAsync(
  input: RescheduleManagedNotificationsInput,
): Promise<RescheduleNotificationsResult> {
  await cancelManagedScheduledNotificationsAsync();

  if (!input.entries.length) {
    return {
      permissionGranted: true,
      scheduledCount: 0,
      skippedPastCount: 0,
    };
  }

  const permissionGranted = await ensureNotificationPermissionAsync();
  if (!permissionGranted) {
    return {
      permissionGranted,
      scheduledCount: 0,
      skippedPastCount: input.entries.length,
    };
  }

  await configureAndroidChannel(input.settings);

  const nowMs = Date.now();
  let scheduledCount = 0;
  let skippedPastCount = 0;
  const reminderMinutes = input.settings.countdownAlerts
    ? getEnabledReminderMinutes(input.settings)
    : [];

  for (const entry of input.entries) {
    const contactDate = parseDateIso(entry.iso);
    if (!contactDate || contactDate.getTime() <= nowMs) {
      skippedPastCount += 1;
      continue;
    }

    const eventTitle = `${entry.contactLabel} Now`;
    const eventBody = `Eclipse ${entry.eclipseDateYmd} is starting at your selected location.`;
    const eventContent = createNotificationContent(eventTitle, eventBody, input.settings, {
      category: "event",
      eclipseId: entry.eclipseId,
      contactKey: entry.contactKey,
      entryId: entry.id,
      ttsText: `${entry.contactLabel}. Eclipse ${entry.eclipseDateYmd}. Event is starting now.`,
    });

    try {
      await scheduleNotificationAsync({
        content: eventContent,
        trigger: buildDateTrigger(contactDate),
      });
      scheduledCount += 1;
    } catch {
      // Ignore individual scheduling failures and continue with remaining requests.
    }

    for (const minutes of reminderMinutes) {
      const reminderDate = new Date(contactDate.getTime() - minutes * 60 * 1000);
      if (reminderDate.getTime() <= nowMs) continue;

      const reminderTitle = `${entry.contactLabel} in ${reminderLabel(minutes)}`;
      const reminderBody = `Upcoming eclipse contact on ${entry.eclipseDateYmd}.`;
      const reminderContent = createNotificationContent(reminderTitle, reminderBody, input.settings, {
        category: "reminder",
        eclipseId: entry.eclipseId,
        contactKey: entry.contactKey,
        leadMinutes: minutes,
        entryId: entry.id,
        ttsText: `${entry.contactLabel} in ${reminderLabel(minutes)}. Eclipse ${entry.eclipseDateYmd}.`,
      });

      try {
        await scheduleNotificationAsync({
          content: reminderContent,
          trigger: buildDateTrigger(reminderDate),
        });
        scheduledCount += 1;
      } catch {
        // Ignore individual scheduling failures and continue with remaining requests.
      }
    }
  }

  return {
    permissionGranted: true,
    scheduledCount,
    skippedPastCount,
  };
}

export async function rescheduleEclipseNotificationsAsync(
  input: RescheduleNotificationsInput,
): Promise<RescheduleNotificationsResult> {
  const entries: ManagedNotificationEntry[] = input.contacts
    .filter((contact) => contact.enabled && !!contact.iso)
    .map((contact) => ({
      id: `${input.eclipseId}:${contact.key}`,
      eclipseId: input.eclipseId,
      eclipseDateYmd: input.eclipseDateYmd,
      contactKey: contact.key,
      contactLabel: contact.label,
      iso: contact.iso as string,
    }));

  return rescheduleManagedNotificationEntriesAsync({
    settings: input.settings,
    entries,
  });
}

export async function scheduleTestNotificationAsync(
  settings: NotificationSchedulingSettings,
): Promise<TestNotificationResult> {
  const permissionGranted = await ensureNotificationPermissionAsync();
  if (!permissionGranted) {
    return {
      ok: false,
      reason: "permission_denied",
    };
  }

  await configureAndroidChannel(settings);

  const fireDate = new Date(Date.now() + 2500);
  const content = createNotificationContent(
    "Eclipse Timer Test Alert",
    "Local notifications are enabled for eclipse events.",
    settings,
    {
      category: "test",
      ttsText: "This is a test eclipse alert notification.",
    },
  );

  try {
    await scheduleNotificationAsync({
      content,
      trigger: buildDateTrigger(fireDate),
    });
  } catch {
    return {
      ok: false,
      reason: "schedule_failed",
    };
  }

  return {
    ok: true,
    fireDate,
  };
}
