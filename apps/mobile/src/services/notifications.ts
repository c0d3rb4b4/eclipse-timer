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
import { readEnvFlag } from "../utils/env";
import {
  buildReminderScheduleRequests,
  enabledReminderMinutes,
  type ReminderScheduleRequest,
  reminderLeadLabel,
} from "./reminderSchedule";

const MANAGED_NOTIFICATION_SOURCE = "eclipse-timer";
const ANDROID_CHANNEL_ID = "eclipse-alerts";
const MAX_SCHEDULED_NOTIFICATIONS_PER_SYNC = 60;
const SKIP_PERMISSION_PROMPT_FLAG = "EXPO_PUBLIC_SKIP_NOTIFICATION_PERMISSION_PROMPT";

let hasConfiguredHandler = false;

export function shouldSkipNotificationPermissionPrompt() {
  return readEnvFlag(SKIP_PERMISSION_PROMPT_FLAG);
}

export type NotificationSchedulingSettings = {
  vibrationEnabled: boolean;
  soundEnabled: boolean;
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
  if (shouldSkipNotificationPermissionPrompt()) return false;

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
