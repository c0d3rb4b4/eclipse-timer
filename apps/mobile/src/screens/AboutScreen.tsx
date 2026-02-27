import Constants from "expo-constants";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import { useAppTheme } from "../theme/useAppTheme";

type AboutScreenProps = {
  onOpenMenu: () => void;
};

type VersionRowProps = {
  label: string;
  value: string;
};

function VersionRow({ label, value }: VersionRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function coerceVersionValue(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "Unavailable";
}

export default function AboutScreen({ onOpenMenu }: AboutScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const appVersion = coerceVersionValue(Constants.nativeAppVersion);
  const buildVersion = coerceVersionValue(Constants.nativeBuildVersion);
  const configuredVersion = coerceVersionValue(Constants.expoConfig?.version);
  const runtimeVersion = coerceVersionValue(Constants.expoConfig?.runtimeVersion);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <Text style={styles.title} accessibilityRole="header">
            About
          </Text>
          <Text style={styles.subtitle}>Build and version information for this app.</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <VersionRow label="App Version" value={appVersion} />
          <VersionRow label="Build" value={buildVersion} />
          <VersionRow label="Configured Version" value={configuredVersion} />
          <VersionRow label="Runtime Version" value={runtimeVersion} />
        </View>
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
      lineHeight: 17,
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
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 10,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    rowLabel: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    rowValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
