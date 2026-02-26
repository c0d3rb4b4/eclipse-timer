import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import { useAppTheme } from "../theme/useAppTheme";

type SettingsScreenProps = {
  onOpenMenu: () => void;
  onOpenNotificationSettings: () => void;
  onOpenLocationSettings: () => void;
  onOpenThemeSettings: () => void;
};

type SettingsActionCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

function SettingsActionCard({ title, subtitle, onPress }: SettingsActionCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

export default function SettingsScreen({
  onOpenMenu,
  onOpenNotificationSettings,
  onOpenLocationSettings,
  onOpenThemeSettings,
}: SettingsScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <Text style={styles.title} accessibilityRole="header">
            Settings
          </Text>
          <Text style={styles.subtitle}>Configure notifications, locations, and app theme.</Text>
        </View>
      </View>

      <View style={styles.content}>
        <SettingsActionCard
          title="Theme Settings"
          subtitle="Switch between system, dark, and light themes."
          onPress={onOpenThemeSettings}
        />
        <SettingsActionCard
          title="Notification/Alarm Settings"
          subtitle="Manage reminder and in-app alarm behavior."
          onPress={onOpenNotificationSettings}
        />
        <SettingsActionCard
          title="Location Settings"
          subtitle="Add and manage favorite observing locations."
          onPress={onOpenLocationSettings}
        />
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.textPrimary,
      fontSize: 21,
      fontWeight: "800",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
    },
    content: {
      paddingHorizontal: 12,
      paddingTop: 14,
      gap: 12,
    },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 4,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    cardSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
  });
}
