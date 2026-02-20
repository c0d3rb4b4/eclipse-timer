import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import {
  type NotificationSchedulingSettings,
  scheduleTestNotificationAsync,
} from "../services/notifications";
import {
  MOCK_FIRST_CONTACT_OFFSET_MINUTES_MAX,
  MOCK_FIRST_CONTACT_OFFSET_MINUTES_MIN,
  MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MAX,
  MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MIN,
  type NotificationEntry,
  type NotificationMockTimeline,
  type NotificationSettings,
} from "../state/appState";
import { fmtLocalHuman } from "../utils/date";

type NotificationSettingsScreenProps = {
  onOpenMenu: () => void;
  settings: NotificationSettings;
  mockTimeline: NotificationMockTimeline;
  notificationEntries: NotificationEntry[];
  onSetSetting: (key: keyof NotificationSettings, value: boolean) => void;
  onSetMockTimelineEnabled: (enabled: boolean) => void;
  onSetMockTimelineOffsets: (
    firstContactOffsetMinutes: number,
    subsequentContactGapMinutes: number,
  ) => void;
  onRemoveNotificationEntry: (id: string) => void;
};

type SettingRowProps = {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (nextValue: boolean) => void;
};

function SettingRow({
  title,
  description,
  value,
  disabled = false,
  onValueChange,
}: SettingRowProps) {
  return (
    <View
      style={[styles.rowCard, disabled ? styles.rowCardDisabled : null]}
      accessibilityRole="none"
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityHint={description}
        accessibilityState={{ checked: value, disabled }}
      />
    </View>
  );
}

function toSchedulingSettings(
  settings: NotificationSettings,
  mockTimeline: NotificationMockTimeline,
): NotificationSchedulingSettings {
  return {
    countdownAlerts: settings.countdownAlerts,
    vibrationEnabled: settings.vibrationEnabled,
    soundEnabled: settings.soundEnabled,
    useTtsVoice: settings.useTtsVoice,
    remindOneHourBefore: settings.remindOneHourBefore,
    remindTenMinutesBefore: settings.remindTenMinutesBefore,
    mockTimelineEnabled: mockTimeline.enabled,
    mockFirstContactOffsetMinutes: mockTimeline.firstContactOffsetMinutes,
    mockSubsequentContactGapMinutes: mockTimeline.subsequentContactGapMinutes,
  };
}

export default function NotificationSettingsScreen({
  onOpenMenu,
  settings,
  mockTimeline,
  notificationEntries,
  onSetSetting,
  onSetMockTimelineEnabled,
  onSetMockTimelineOffsets,
  onRemoveNotificationEntry,
}: NotificationSettingsScreenProps) {
  const [isSchedulingTest, setIsSchedulingTest] = useState(false);
  const [mockFirstOffsetText, setMockFirstOffsetText] = useState(
    String(mockTimeline.firstContactOffsetMinutes),
  );
  const [mockGapOffsetText, setMockGapOffsetText] = useState(
    String(mockTimeline.subsequentContactGapMinutes),
  );
  const [mockValidationMessage, setMockValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    setMockFirstOffsetText(String(mockTimeline.firstContactOffsetMinutes));
  }, [mockTimeline.firstContactOffsetMinutes]);

  useEffect(() => {
    setMockGapOffsetText(String(mockTimeline.subsequentContactGapMinutes));
  }, [mockTimeline.subsequentContactGapMinutes]);

  const groupedEntries = useMemo(() => {
    const sorted = [...notificationEntries].sort((a, b) => {
      if (a.eclipseDateYmd !== b.eclipseDateYmd)
        return a.eclipseDateYmd.localeCompare(b.eclipseDateYmd);
      const aTs = Date.parse(a.iso);
      const bTs = Date.parse(b.iso);
      if (Number.isFinite(aTs) && Number.isFinite(bTs) && aTs !== bTs) return aTs - bTs;
      if (a.contactLabel !== b.contactLabel) return a.contactLabel.localeCompare(b.contactLabel);
      return a.id.localeCompare(b.id);
    });

    const groups = new Map<
      string,
      { key: string; eclipseLabel: string; eclipseDateYmd: string; entries: NotificationEntry[] }
    >();

    for (const entry of sorted) {
      const key = `${entry.eclipseId}::${entry.eclipseDateYmd}`;
      const existing = groups.get(key);
      if (existing) {
        existing.entries.push(entry);
        continue;
      }

      groups.set(key, {
        key,
        eclipseLabel: entry.eclipseLabel || entry.eclipseId,
        eclipseDateYmd: entry.eclipseDateYmd,
        entries: [entry],
      });
    }

    return [...groups.values()];
  }, [notificationEntries]);

  const runNotificationTest = () => {
    if (!settings.eclipseAlerts) {
      Alert.alert("Test Notification", "Enable Eclipse Event Alerts first.");
      return;
    }

    setIsSchedulingTest(true);

    void scheduleTestNotificationAsync(toSchedulingSettings(settings, mockTimeline))
      .then((outcome) => {
        if (!outcome.ok) {
          if (outcome.reason === "permission_denied") {
            Alert.alert(
              "Test Notification",
              "Notifications are blocked by system permissions. Enable them in device settings.",
            );
            return;
          }

          Alert.alert("Test Notification", "Failed to schedule a test notification.");
          return;
        }

        const hh = String(outcome.fireDate.getHours()).padStart(2, "0");
        const mm = String(outcome.fireDate.getMinutes()).padStart(2, "0");
        const ss = String(outcome.fireDate.getSeconds()).padStart(2, "0");
        Alert.alert("Test Notification", `Notification scheduled for ${hh}:${mm}:${ss}.`);
      })
      .catch(() => {
        Alert.alert("Test Notification", "Failed to schedule a test notification.");
      })
      .finally(() => {
        setIsSchedulingTest(false);
      });
  };

  const commitMockTimelineOffsets = () => {
    const firstRaw = Number(mockFirstOffsetText.trim());
    if (!Number.isFinite(firstRaw)) {
      setMockValidationMessage("C1 offset must be a valid number.");
      return false;
    }

    const firstContactOffsetMinutes = Math.round(firstRaw);
    if (
      firstContactOffsetMinutes < MOCK_FIRST_CONTACT_OFFSET_MINUTES_MIN ||
      firstContactOffsetMinutes > MOCK_FIRST_CONTACT_OFFSET_MINUTES_MAX
    ) {
      setMockValidationMessage(
        `C1 offset must be between ${MOCK_FIRST_CONTACT_OFFSET_MINUTES_MIN} and ${MOCK_FIRST_CONTACT_OFFSET_MINUTES_MAX} minutes.`,
      );
      return false;
    }

    const gapRaw = Number(mockGapOffsetText.trim());
    if (!Number.isFinite(gapRaw)) {
      setMockValidationMessage("Gap must be a valid number.");
      return false;
    }

    const subsequentContactGapMinutes = Math.round(gapRaw);
    if (
      subsequentContactGapMinutes < MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MIN ||
      subsequentContactGapMinutes > MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MAX
    ) {
      setMockValidationMessage(
        `Gap must be between ${MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MIN} and ${MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MAX} minutes.`,
      );
      return false;
    }

    onSetMockTimelineOffsets(firstContactOffsetMinutes, subsequentContactGapMinutes);
    setMockFirstOffsetText(String(firstContactOffsetMinutes));
    setMockGapOffsetText(String(subsequentContactGapMinutes));
    setMockValidationMessage(null);
    return true;
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <Text style={styles.title} accessibilityRole="header">
            Notification Settings
          </Text>
          <Text style={styles.subtitle}>Manage how eclipse alerts should behave.</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <SettingRow
          title="Eclipse Event Alerts"
          description="Enable notifications around eclipse contact events."
          value={settings.eclipseAlerts}
          onValueChange={(nextValue) => onSetSetting("eclipseAlerts", nextValue)}
        />
        <SettingRow
          title="Countdown Reminders"
          description="Receive reminder notifications as key events get closer."
          value={settings.countdownAlerts}
          onValueChange={(nextValue) => onSetSetting("countdownAlerts", nextValue)}
        />
        <SettingRow
          title="Vibration"
          description="Vibrate when an enabled eclipse alert is delivered."
          value={settings.vibrationEnabled}
          onValueChange={(nextValue) => onSetSetting("vibrationEnabled", nextValue)}
        />
        <SettingRow
          title="Sound"
          description="Use default system notification sound."
          value={settings.soundEnabled}
          disabled={settings.useTtsVoice}
          onValueChange={(nextValue) => onSetSetting("soundEnabled", nextValue)}
        />
        <SettingRow
          title="Voice (TTS)"
          description="Speak event details instead of system sound (foreground playback for now)."
          value={settings.useTtsVoice}
          onValueChange={(nextValue) => onSetSetting("useTtsVoice", nextValue)}
        />
        <SettingRow
          title="1 Hour Reminder"
          description="Send a countdown reminder one hour before each enabled contact."
          value={settings.remindOneHourBefore}
          disabled={!settings.countdownAlerts}
          onValueChange={(nextValue) => onSetSetting("remindOneHourBefore", nextValue)}
        />
        <SettingRow
          title="10 Minute Reminder"
          description="Send a countdown reminder ten minutes before each enabled contact."
          value={settings.remindTenMinutesBefore}
          disabled={!settings.countdownAlerts}
          onValueChange={(nextValue) => onSetSetting("remindTenMinutesBefore", nextValue)}
        />
        <View style={styles.mockCard}>
          <View style={styles.mockHeaderRow}>
            <View style={styles.mockHeaderMain}>
              <Text style={styles.mockTitle}>Mock Contact Timeline</Text>
              <Text style={styles.mockDescription}>
                Shift C1/C2/MAX/C3/C4 to run near now for on-device alarm testing.
              </Text>
            </View>
            <Switch
              value={mockTimeline.enabled}
              onValueChange={(nextValue) => {
                if (nextValue) {
                  commitMockTimelineOffsets();
                }
                onSetMockTimelineEnabled(nextValue);
                if (!nextValue) {
                  setMockValidationMessage(null);
                }
              }}
              accessibilityRole="switch"
              accessibilityLabel="Enable mock contact timeline"
            />
          </View>

          <View style={styles.mockInputRow}>
            <View style={styles.mockInputGroup}>
              <Text style={styles.mockInputLabel}>C1 in (min)</Text>
              <TextInput
                value={mockFirstOffsetText}
                onChangeText={setMockFirstOffsetText}
                onEndEditing={commitMockTimelineOffsets}
                onSubmitEditing={commitMockTimelineOffsets}
                placeholder="5"
                placeholderTextColor="#6f6f6f"
                style={[styles.mockInput, !mockTimeline.enabled ? styles.mockInputDisabled : null]}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                editable={mockTimeline.enabled}
              />
            </View>
            <View style={styles.mockInputGroup}>
              <Text style={styles.mockInputLabel}>Gap (min)</Text>
              <TextInput
                value={mockGapOffsetText}
                onChangeText={setMockGapOffsetText}
                onEndEditing={commitMockTimelineOffsets}
                onSubmitEditing={commitMockTimelineOffsets}
                placeholder="1"
                placeholderTextColor="#6f6f6f"
                style={[styles.mockInput, !mockTimeline.enabled ? styles.mockInputDisabled : null]}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                editable={mockTimeline.enabled}
              />
            </View>
          </View>
          <Text style={styles.mockStatus}>
            {mockTimeline.enabled
              ? `Mock mode ON. Sequence repeats: C1 +${mockTimeline.firstContactOffsetMinutes}m, then +${mockTimeline.subsequentContactGapMinutes}m per contact, then loops.`
              : "Mock mode OFF."}
          </Text>
          <Text style={styles.mockHint}>Values save automatically when valid.</Text>
          {mockValidationMessage ? (
            <Text style={styles.mockError}>{mockValidationMessage}</Text>
          ) : null}
        </View>

        <View style={styles.testCard}>
          <Text style={styles.testTitle}>Test Notification</Text>
          <Text style={styles.testDescription}>
            Send a test alert using your current sound/vibration settings.
          </Text>
          <Pressable
            style={[styles.testButton, isSchedulingTest ? styles.testButtonDisabled : null]}
            onPress={runNotificationTest}
            disabled={isSchedulingTest}
            accessibilityRole="button"
            accessibilityLabel="Send test notification"
          >
            <Text style={styles.testButtonText}>
              {isSchedulingTest ? "Scheduling..." : "Send Test Notification"}
            </Text>
          </Pressable>
          {!settings.eclipseAlerts ? (
            <Text style={styles.testHint}>
              Enable Eclipse Event Alerts to run test notifications.
            </Text>
          ) : null}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Enabled Event Notifications</Text>
          {!groupedEntries.length ? (
            <Text style={styles.listEmpty}>
              No event alarms enabled yet. Enable alarms from the Timer screen contacts list.
            </Text>
          ) : (
            groupedEntries.map((group) => (
              <View key={group.key} style={styles.eclipseGroup}>
                <View style={styles.eclipseHeader}>
                  <Text style={styles.eclipseTitle}>{group.eclipseLabel}</Text>
                  <Text style={styles.eclipseDate}>{group.eclipseDateYmd}</Text>
                </View>
                {group.entries.map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={styles.entryMain}>
                      <Text style={styles.entryLabel}>{entry.contactLabel}</Text>
                      <Text style={styles.entryTime}>{fmtLocalHuman(entry.iso)}</Text>
                    </View>
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => onRemoveNotificationEntry(entry.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${entry.contactLabel}`}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0b0b0b",
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerMeta: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "white",
    fontSize: 21,
    fontWeight: "800",
  },
  subtitle: {
    color: "#b7b7b7",
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 10,
  },
  rowCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#141414",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowCardDisabled: {
    opacity: 0.6,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "700",
  },
  rowDescription: {
    color: "#a8a8a8",
    fontSize: 12,
    lineHeight: 18,
  },
  testCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#141414",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  testTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "700",
  },
  testDescription: {
    color: "#a8a8a8",
    fontSize: 12,
    lineHeight: 18,
  },
  testButton: {
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: "#2c3cff",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  testButtonDisabled: {
    opacity: 0.7,
  },
  testButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  testHint: {
    color: "#b6b6b6",
    fontSize: 12,
  },
  mockCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#141414",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  mockHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  mockHeaderMain: {
    flex: 1,
    gap: 4,
  },
  mockTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "700",
  },
  mockDescription: {
    color: "#a8a8a8",
    fontSize: 12,
    lineHeight: 18,
  },
  mockInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  mockInputGroup: {
    flex: 1,
    gap: 4,
  },
  mockInputLabel: {
    color: "#d3d3d3",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  mockInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#1b1b1b",
    color: "white",
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  mockInputDisabled: {
    opacity: 0.55,
  },
  mockStatus: {
    color: "#d7d7d7",
    fontSize: 12,
    lineHeight: 18,
  },
  mockHint: {
    color: "#b6b6b6",
    fontSize: 12,
  },
  mockError: {
    color: "#ff8c8c",
    fontSize: 12,
  },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#141414",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  listTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "700",
  },
  listEmpty: {
    color: "#a8a8a8",
    fontSize: 12,
    lineHeight: 18,
  },
  eclipseGroup: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#191919",
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  eclipseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  eclipseTitle: {
    flex: 1,
    color: "#f2f2f2",
    fontSize: 13,
    fontWeight: "700",
  },
  eclipseDate: {
    color: "#a8a8a8",
    fontSize: 11,
    fontWeight: "600",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#303030",
    backgroundColor: "#121212",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  entryMain: {
    flex: 1,
    gap: 2,
  },
  entryLabel: {
    color: "#e6e6e6",
    fontSize: 12,
    fontWeight: "600",
  },
  entryTime: {
    color: "#9e9e9e",
    fontSize: 11,
  },
  removeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    backgroundColor: "#1f1f1f",
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  removeButtonText: {
    color: "#d5d5d5",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
