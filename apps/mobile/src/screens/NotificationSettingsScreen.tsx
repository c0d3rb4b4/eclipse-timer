import * as Speech from "expo-speech";
import { useEffect, useState } from "react";
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
  ALARM_COUNTDOWN_START_SECONDS_A2_MAX,
  ALARM_COUNTDOWN_START_SECONDS_A2_MIN,
  ALARM_LEAD_SECONDS_A1_MAX,
  ALARM_LEAD_SECONDS_A1_MIN,
  MOCK_FIRST_CONTACT_OFFSET_MINUTES_MAX,
  MOCK_FIRST_CONTACT_OFFSET_MINUTES_MIN,
  MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MAX,
  MOCK_SUBSEQUENT_CONTACT_GAP_MINUTES_MIN,
  type NotificationMockTimeline,
  type NotificationSettings,
  type NotificationSettingToggleKey,
} from "../state/appState";

type NotificationSettingsScreenProps = {
  onOpenMenu: () => void;
  settings: NotificationSettings;
  mockTimeline: NotificationMockTimeline;
  onSetSetting: (key: NotificationSettingToggleKey, value: boolean) => void;
  onSetAlarmTiming: (alarmLeadSecondsA1: number, alarmCountdownStartSecondsA2: number) => void;
  onSetMockTimelineEnabled: (enabled: boolean) => void;
  onSetMockTimelineOffsets: (
    firstContactOffsetMinutes: number,
    subsequentContactGapMinutes: number,
  ) => void;
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

export default function NotificationSettingsScreen({
  onOpenMenu,
  settings,
  mockTimeline,
  onSetSetting,
  onSetAlarmTiming,
  onSetMockTimelineEnabled,
  onSetMockTimelineOffsets,
}: NotificationSettingsScreenProps) {
  const [isPlayingTestTts, setIsPlayingTestTts] = useState(false);
  const [mockFirstOffsetText, setMockFirstOffsetText] = useState(
    String(mockTimeline.firstContactOffsetMinutes),
  );
  const [mockGapOffsetText, setMockGapOffsetText] = useState(
    String(mockTimeline.subsequentContactGapMinutes),
  );
  const [mockValidationMessage, setMockValidationMessage] = useState<string | null>(null);
  const [alarmLeadText, setAlarmLeadText] = useState(String(settings.alarmLeadSecondsA1));
  const [alarmCountdownText, setAlarmCountdownText] = useState(
    String(settings.alarmCountdownStartSecondsA2),
  );
  const [alarmValidationMessage, setAlarmValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    setMockFirstOffsetText(String(mockTimeline.firstContactOffsetMinutes));
  }, [mockTimeline.firstContactOffsetMinutes]);

  useEffect(() => {
    setMockGapOffsetText(String(mockTimeline.subsequentContactGapMinutes));
  }, [mockTimeline.subsequentContactGapMinutes]);

  useEffect(() => {
    setAlarmLeadText(String(settings.alarmLeadSecondsA1));
  }, [settings.alarmLeadSecondsA1]);

  useEffect(() => {
    setAlarmCountdownText(String(settings.alarmCountdownStartSecondsA2));
  }, [settings.alarmCountdownStartSecondsA2]);

  const runTtsAlarmTest = () => {
    setIsPlayingTestTts(true);

    const finish = () => {
      setIsPlayingTestTts(false);
    };

    try {
      void Speech.stop();
      void Speech.speak(
        "This is a test TTS alarm. Ten seconds to C1. Five. Four. Three. Two. One. Partial eclipse started.",
        {
          onDone: finish,
          onStopped: finish,
          onError: finish,
        },
      );
    } catch {
      finish();
      Alert.alert("Test TTS Alarm", "Failed to play the test TTS alarm.");
    }
  };

  const commitAlarmTiming = () => {
    const a1Raw = Number(alarmLeadText.trim());
    if (!Number.isFinite(a1Raw)) {
      setAlarmValidationMessage("a1 lead time must be a valid number.");
      return false;
    }
    const alarmLeadSecondsA1 = Math.round(a1Raw);
    if (
      alarmLeadSecondsA1 < ALARM_LEAD_SECONDS_A1_MIN ||
      alarmLeadSecondsA1 > ALARM_LEAD_SECONDS_A1_MAX
    ) {
      setAlarmValidationMessage(
        `a1 lead time must be between ${ALARM_LEAD_SECONDS_A1_MIN} and ${ALARM_LEAD_SECONDS_A1_MAX} seconds.`,
      );
      return false;
    }

    const a2Raw = Number(alarmCountdownText.trim());
    if (!Number.isFinite(a2Raw)) {
      setAlarmValidationMessage("a2 countdown start must be a valid number.");
      return false;
    }
    const alarmCountdownStartSecondsA2 = Math.round(a2Raw);
    if (
      alarmCountdownStartSecondsA2 < ALARM_COUNTDOWN_START_SECONDS_A2_MIN ||
      alarmCountdownStartSecondsA2 > ALARM_COUNTDOWN_START_SECONDS_A2_MAX
    ) {
      setAlarmValidationMessage(
        `a2 countdown start must be between ${ALARM_COUNTDOWN_START_SECONDS_A2_MIN} and ${ALARM_COUNTDOWN_START_SECONDS_A2_MAX} seconds.`,
      );
      return false;
    }

    if (alarmCountdownStartSecondsA2 >= alarmLeadSecondsA1) {
      setAlarmValidationMessage("a2 must be lower than a1.");
      return false;
    }

    onSetAlarmTiming(alarmLeadSecondsA1, alarmCountdownStartSecondsA2);
    setAlarmLeadText(String(alarmLeadSecondsA1));
    setAlarmCountdownText(String(alarmCountdownStartSecondsA2));
    setAlarmValidationMessage(null);
    return true;
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
            Notification/Alarm Settings
          </Text>
          <Text style={styles.subtitle}>
            Manage background reminders and in-app TTS alarm timing.
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <SettingRow
          title="Vibration"
          description="Vibrate when a background eclipse reminder is delivered."
          value={settings.vibrationEnabled}
          onValueChange={(nextValue) => onSetSetting("vibrationEnabled", nextValue)}
        />
        <SettingRow
          title="Sound"
          description="Play default system notification sound for background reminders."
          value={settings.soundEnabled}
          onValueChange={(nextValue) => onSetSetting("soundEnabled", nextValue)}
        />
        <SettingRow
          title="1 Hour Reminder"
          description="Send one background reminder at T-1h for each enabled eclipse."
          value={settings.remindOneHourBefore}
          onValueChange={(nextValue) => onSetSetting("remindOneHourBefore", nextValue)}
        />
        <SettingRow
          title="10 Minute Reminder"
          description="Send one background reminder at T-10m for each enabled eclipse."
          value={settings.remindTenMinutesBefore}
          onValueChange={(nextValue) => onSetSetting("remindTenMinutesBefore", nextValue)}
        />
        <View style={styles.alarmTimingCard}>
          <Text style={styles.alarmTimingTitle}>Alarm Timing</Text>
          <Text style={styles.alarmTimingDescription}>
            Configure in-app foreground voice prompts for each enabled event alarm.
          </Text>
          <View style={styles.mockInputRow}>
            <View style={styles.mockInputGroup}>
              <Text style={styles.mockInputLabel}>a1 lead (sec)</Text>
              <TextInput
                value={alarmLeadText}
                onChangeText={setAlarmLeadText}
                onEndEditing={commitAlarmTiming}
                onSubmitEditing={commitAlarmTiming}
                placeholder="10"
                placeholderTextColor="#6f6f6f"
                style={styles.mockInput}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.mockInputGroup}>
              <Text style={styles.mockInputLabel}>a2 countdown (sec)</Text>
              <TextInput
                value={alarmCountdownText}
                onChangeText={setAlarmCountdownText}
                onEndEditing={commitAlarmTiming}
                onSubmitEditing={commitAlarmTiming}
                placeholder="5"
                placeholderTextColor="#6f6f6f"
                style={styles.mockInput}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <Text style={styles.alarmTimingPreview}>
            At T-{settings.alarmLeadSecondsA1}s: "{settings.alarmLeadSecondsA1} seconds to C1"; at
            T-{settings.alarmCountdownStartSecondsA2}s: "{settings.alarmCountdownStartSecondsA2}..
            {Math.max(1, settings.alarmCountdownStartSecondsA2 - 1)}.. ... 1.. Partial eclipse
            started".
          </Text>
          <Text style={styles.alarmTimingPreview}>
            Also sends one background reminder at T-1h and one at T-10m for the eclipse (based on
            first event time), even if app is closed.
          </Text>
          {alarmValidationMessage ? (
            <Text style={styles.mockError}>{alarmValidationMessage}</Text>
          ) : null}
        </View>
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
          <Text style={styles.testTitle}>Test TTS Alarm</Text>
          <Text style={styles.testDescription}>
            Play a sample in-app alarm voice sequence using device TTS.
          </Text>
          <Pressable
            style={[styles.testButton, isPlayingTestTts ? styles.testButtonDisabled : null]}
            onPress={runTtsAlarmTest}
            disabled={isPlayingTestTts}
            accessibilityRole="button"
            accessibilityLabel="Play test TTS alarm"
          >
            <Text style={styles.testButtonText}>
              {isPlayingTestTts ? "Playing..." : "Play Test TTS Alarm"}
            </Text>
          </Pressable>
          <Text style={styles.testHint}>
            This test is foreground-only and does not change reminder schedules.
          </Text>
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
  alarmTimingCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#141414",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  alarmTimingTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "700",
  },
  alarmTimingDescription: {
    color: "#a8a8a8",
    fontSize: 12,
    lineHeight: 18,
  },
  alarmTimingPreview: {
    color: "#d7d7d7",
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
});
