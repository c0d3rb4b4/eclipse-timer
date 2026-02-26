import { useCallback, useMemo } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import { useAppTheme } from "../theme/useAppTheme";
import { HELP_DOC_LINKS, HELP_FAQ_ITEMS, HELP_TROUBLESHOOTING_ITEMS } from "./helpContent";

type HelpScreenProps = {
  onOpenMenu: () => void;
};

export default function HelpScreen({ onOpenMenu }: HelpScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const openDocLink = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert("Unable to open link", "Please check your connection and try again.");
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <Text style={styles.title} accessibilityRole="header">
            Help & FAQ
          </Text>
          <Text style={styles.subtitle}>
            Quick answers, troubleshooting, and links to complete documentation.
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {HELP_FAQ_ITEMS.map((item) => (
            <View style={styles.entryCard} key={item.question}>
              <Text style={styles.entryTitle}>{item.question}</Text>
              <Text style={styles.entryBody}>{item.answer}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          {HELP_TROUBLESHOOTING_ITEMS.map((item) => (
            <View style={styles.entryCard} key={item.title}>
              <Text style={styles.entryTitle}>{item.title}</Text>
              <Text style={styles.entryBody}>{item.resolution}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Full Documentation</Text>
          {HELP_DOC_LINKS.map((link) => (
            <Pressable
              key={link.url}
              style={styles.docCard}
              onPress={() => openDocLink(link.url)}
              accessibilityRole="button"
              accessibilityLabel={link.title}
              accessibilityHint={link.description}
            >
              <View style={styles.docMain}>
                <Text style={styles.entryTitle}>{link.title}</Text>
                <Text style={styles.entryBody}>{link.description}</Text>
              </View>
              <Text style={styles.openLabel}>Open</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
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
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 24,
      gap: 14,
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },
    entryCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 6,
    },
    entryTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    entryBody: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    docCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 12,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    docMain: {
      flex: 1,
      gap: 4,
    },
    openLabel: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  });
}
