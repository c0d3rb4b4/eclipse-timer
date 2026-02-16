import { StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import type { NotificationSettings } from "../state/appState";

type NotificationSettingsScreenProps = {
  onOpenMenu: () => void;
  settings: NotificationSettings;
  onSetSetting: (key: keyof NotificationSettings, value: boolean) => void;
};

type SettingRowProps = {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (nextValue: boolean) => void;
};

function SettingRow({ title, description, value, disabled = false, onValueChange }: SettingRowProps) {
  return (
    <View style={[styles.rowCard, disabled ? styles.rowCardDisabled : null]}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}

export default function NotificationSettingsScreen({
  onOpenMenu,
  settings,
  onSetSetting,
}: NotificationSettingsScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <Text style={styles.title}>Notification Settings</Text>
          <Text style={styles.subtitle}>Manage how eclipse alerts should behave.</Text>
        </View>
      </View>

      <View style={styles.content}>
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
          description="Play sound for eclipse alerts and reminder notifications."
          value={settings.soundEnabled}
          onValueChange={(nextValue) => onSetSetting("soundEnabled", nextValue)}
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
      </View>
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
    paddingHorizontal: 12,
    paddingTop: 14,
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
});
