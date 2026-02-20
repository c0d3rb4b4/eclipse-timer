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
import {
  buildReminderScheduleRequests,
  enabledReminderMinutes,
  type ReminderScheduleRequest,
  reminderLeadLabel,
} from "./reminderSchedule";

const MANAGED_NOTIFICATION_SOURCE = "eclipse-timer";
const ANDROID_CHANNEL_ID = "eclipse-alerts";
const MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC = 60;

let hasConfiguredHandler = false;

export type NotificationSchedulingSettings = {
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  useTtsVoice: boolean;
  remindOneHourBefore: boolean;
  remindTenMinutesBefore: boolean;
};

export type ManagedEclipseReminderEntry = {
  id: string;
  eclipseId: string;
  eclipseDateYmd: string;
  eclipseLabel: string;
  firstEventIso: string;
};

export type RescheduleManagedEclipseRemindersInput = {
  settings: NotificationSchedulingSettings;
  entries: ManagedEclipseReminderEntry[];
};

export type RescheduleNotificationsResult = {
  permissionGranted: boolean;
  scheduledCount: number;
  skippedPastCount: number;
};

export type ManagedReminderScheduleRequest = ReminderScheduleRequest<ManagedEclipseReminderEntry>;

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

export async function rescheduleManagedEclipseReminderEntriesAsync(
  input: RescheduleManagedEclipseRemindersInput,
): Promise<RescheduleNotificationsResult> {
  await cancelManagedScheduledNotificationsAsync();

  const reminderMinutes = enabledReminderMinutes(input.settings);
  if (!input.entries.length || !reminderMinutes.length) {
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
      skippedPastCount: input.entries.length * reminderMinutes.length,
    };
  }

  await configureAndroidChannel(input.settings);

  const { requests, skippedPastCount } = buildReminderScheduleRequests(
    input.settings,
    input.entries,
    Date.now(),
  );
  let scheduledCount = 0;

  for (const request of requests) {
    if (scheduledCount >= MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC) break;

    const title = `Eclipse in ${reminderLeadLabel(request.leadMinutes)}`;
    const body = `${request.entry.eclipseLabel} (${request.entry.eclipseDateYmd}) starts soon at your selected location.`;
    const content = createNotificationContent(title, body, input.settings, {
      category: "eclipse_reminder",
      eclipseId: request.entry.eclipseId,
      leadMinutes: request.leadMinutes,
      entryId: request.entry.id,
      ttsText: `${request.entry.eclipseLabel} eclipse in ${reminderLeadLabel(request.leadMinutes)}.`,
    });

    try {
      await scheduleNotificationAsync({
        content,
        trigger: buildDateTrigger(request.fireDate),
      });
      scheduledCount += 1;
    } catch {
      // Continue scheduling remaining reminders.
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
    "Local reminder notifications are enabled.",
    settings,
    {
      category: "test",
      ttsText: "This is a test eclipse reminder notification.",
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
