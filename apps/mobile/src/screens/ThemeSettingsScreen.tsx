import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import type { AppThemePreference } from "../state/appState";
import { useAppTheme } from "../theme/useAppTheme";

type ThemeSettingsScreenProps = {
  onOpenMenu: () => void;
  preference: AppThemePreference;
  onSetThemePreference: (preference: AppThemePreference) => void;
};

type ThemeOptionProps = {
  label: string;
  description: string;
  value: AppThemePreference;
  selected: boolean;
  onPress: (value: AppThemePreference) => void;
};

function ThemeOption({ label, description, value, selected, onPress }: ThemeOptionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
      onPress={() => onPress(value)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ selected }}
    >
      <View style={styles.optionHeaderRow}>
        <Text style={[styles.optionTitle, selected ? styles.optionTitleSelected : null]}>
          {label}
        </Text>
        <View style={[styles.optionDot, selected ? styles.optionDotSelected : null]} />
      </View>
      <Text style={styles.optionDescription}>{description}</Text>
    </Pressable>
  );
}

export default function ThemeSettingsScreen({
  onOpenMenu,
  preference,
  onSetThemePreference,
}: ThemeSettingsScreenProps) {
  const { colors, resolvedTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <Text style={styles.title} accessibilityRole="header">
            Theme Settings
          </Text>
          <Text style={styles.subtitle}>
            Current mode: {resolvedTheme === "dark" ? "Dark" : "Light"} (
            {preference === "system" ? "System" : preference === "dark" ? "Dark" : "Light"})
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <ThemeOption
          label="System"
          description="Follow your device appearance setting automatically."
          value="system"
          selected={preference === "system"}
          onPress={onSetThemePreference}
        />
        <ThemeOption
          label="Light"
          description="Always use the light appearance."
          value="light"
          selected={preference === "light"}
          onPress={onSetThemePreference}
        />
        <ThemeOption
          label="Dark"
          description="Always use the dark appearance."
          value="dark"
          selected={preference === "dark"}
          onPress={onSetThemePreference}
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
    optionCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 13,
      paddingHorizontal: 12,
      gap: 6,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    optionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    optionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    optionTitleSelected: {
      color: colors.textPrimary,
    },
    optionDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    optionDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      backgroundColor: "transparent",
    },
    optionDotSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
  });
}
