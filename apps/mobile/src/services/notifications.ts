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
  const content: NotificationContentInput = {
    title,
    body,
    data: managedNotificationData(data),
    sound: settings.soundEnabled ? "default" : false,
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
    sound: settings.soundEnabled ? "default" : null,
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

export async function rescheduleEclipseNotificationsAsync(
  input: RescheduleNotificationsInput,
): Promise<RescheduleNotificationsResult> {
  await cancelManagedScheduledNotificationsAsync();

  const contactsToSchedule = input.contacts.filter((contact) => contact.enabled);
  if (!contactsToSchedule.length) {
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
      skippedPastCount: contactsToSchedule.length,
    };
  }

  await configureAndroidChannel(input.settings);

  const nowMs = Date.now();
  let scheduledCount = 0;
  let skippedPastCount = 0;
  const reminderMinutes = input.settings.countdownAlerts
    ? getEnabledReminderMinutes(input.settings)
    : [];

  for (const contact of contactsToSchedule) {
    const contactDate = parseDateIso(contact.iso);
    if (!contactDate || contactDate.getTime() <= nowMs) {
      skippedPastCount += 1;
      continue;
    }

    const eventTitle = `${contact.label} Now`;
    const eventBody = `Eclipse ${input.eclipseDateYmd} is starting at your selected location.`;
    const eventContent = createNotificationContent(eventTitle, eventBody, input.settings, {
      category: "event",
      eclipseId: input.eclipseId,
      contactKey: contact.key,
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

      const reminderTitle = `${contact.label} in ${reminderLabel(minutes)}`;
      const reminderBody = `Upcoming eclipse contact on ${input.eclipseDateYmd}.`;
      const reminderContent = createNotificationContent(reminderTitle, reminderBody, input.settings, {
        category: "reminder",
        eclipseId: input.eclipseId,
        contactKey: contact.key,
        leadMinutes: minutes,
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
    { category: "test" },
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
