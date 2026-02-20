import cancelScheduledNotificationAsync from "expo-notifications/build/cancelScheduledNotificationAsync";
import getAllScheduledNotificationsAsync from "expo-notifications/build/getAllScheduledNotificationsAsync";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications/build/NotificationPermissions";
import {
  type DateTriggerInput,
  type NotificationContentInput,
  type NotificationRequest,
  SchedulableTriggerInputTypes,
} from "expo-notifications/build/Notifications.types";
import { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";
import scheduleNotificationAsync from "expo-notifications/build/scheduleNotificationAsync";
import setNotificationChannelAsync from "expo-notifications/build/setNotificationChannelAsync";
import { Platform } from "react-native";

const MANAGED_NOTIFICATION_SOURCE = "eclipse-timer";
const ANDROID_CHANNEL_ID = "eclipse-alerts";
const MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC = 60;
const MOCK_TIMELINE_SCHEDULE_HORIZON_HOURS = 24;
const CONTACT_CYCLE_ORDER: Record<string, number> = {
  c1: 0,
  c2: 1,
  max: 2,
  c3: 3,
  c4: 4,
};
const CONTACTS_PER_MOCK_CYCLE = 5;

let hasConfiguredHandler = false;

export type NotificationSchedulingSettings = {
  countdownAlerts: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  useTtsVoice: boolean;
  remindOneHourBefore: boolean;
  remindTenMinutesBefore: boolean;
  mockTimelineEnabled: boolean;
  mockFirstContactOffsetMinutes: number;
  mockSubsequentContactGapMinutes: number;
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

function contactCycleIndex(contactKey: string) {
  const normalized = contactKey.trim().toLowerCase();
  const index = CONTACT_CYCLE_ORDER[normalized];
  return typeof index === "number" ? index : null;
}

function mockFirstOffsetMs(settings: NotificationSchedulingSettings) {
  return Math.max(1, Math.round(settings.mockFirstContactOffsetMinutes)) * 60 * 1000;
}

function mockGapMs(settings: NotificationSchedulingSettings) {
  return Math.max(1, Math.round(settings.mockSubsequentContactGapMinutes)) * 60 * 1000;
}

function mockCycleDurationMs(settings: NotificationSchedulingSettings) {
  return mockFirstOffsetMs(settings) + mockGapMs(settings) * (CONTACTS_PER_MOCK_CYCLE - 1);
}

function mockContactDate(
  settings: NotificationSchedulingSettings,
  nowMs: number,
  contactKey: string,
  cycle: number,
) {
  const index = contactCycleIndex(contactKey);
  if (index === null) return null;

  const eventMs =
    nowMs +
    mockFirstOffsetMs(settings) +
    index * mockGapMs(settings) +
    cycle * mockCycleDurationMs(settings);
  return new Date(eventMs);
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

  const scheduleEntryAt = async (entry: ManagedNotificationEntry, contactDate: Date) => {
    if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC) return;

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
      if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC) return;

      const reminderDate = new Date(contactDate.getTime() - minutes * 60 * 1000);
      if (reminderDate.getTime() <= nowMs) continue;

      const reminderTitle = `${entry.contactLabel} in ${reminderLabel(minutes)}`;
      const reminderBody = `Upcoming eclipse contact on ${entry.eclipseDateYmd}.`;
      const reminderContent = createNotificationContent(
        reminderTitle,
        reminderBody,
        input.settings,
        {
          category: "reminder",
          eclipseId: entry.eclipseId,
          contactKey: entry.contactKey,
          leadMinutes: minutes,
          entryId: entry.id,
          ttsText: `${entry.contactLabel} in ${reminderLabel(minutes)}. Eclipse ${entry.eclipseDateYmd}.`,
        },
      );

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
  };

  if (input.settings.mockTimelineEnabled) {
    const horizonMs = nowMs + MOCK_TIMELINE_SCHEDULE_HORIZON_HOURS * 60 * 60 * 1000;
    const cycleDurationMs = mockCycleDurationMs(input.settings);

    for (const entry of input.entries) {
      const cycleIndex = contactCycleIndex(entry.contactKey);
      if (cycleIndex === null) {
        const fallbackDate = parseDateIso(entry.iso);
        if (!fallbackDate || fallbackDate.getTime() <= nowMs) {
          skippedPastCount += 1;
          continue;
        }

        await scheduleEntryAt(entry, fallbackDate);
        if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC) break;
        continue;
      }

      let cycle = 0;
      while (scheduledCount < MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC) {
        const contactDate = mockContactDate(input.settings, nowMs, entry.contactKey, cycle);
        if (!contactDate) break;
        const contactMs = contactDate.getTime();
        if (!Number.isFinite(contactMs) || contactMs > horizonMs) break;

        await scheduleEntryAt(entry, contactDate);
        cycle += 1;

        if (contactMs + cycleDurationMs > horizonMs) break;
      }

      if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC) break;
    }
  } else {
    for (const entry of input.entries) {
      const contactDate = parseDateIso(entry.iso);
      if (!contactDate || contactDate.getTime() <= nowMs) {
        skippedPastCount += 1;
        continue;
      }

      await scheduleEntryAt(entry, contactDate);
      if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC) break;
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
