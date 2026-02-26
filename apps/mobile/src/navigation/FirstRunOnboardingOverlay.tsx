import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/useAppTheme";
import {
  type OnboardingRouteName,
  type OnboardingWalkthroughStep,
  onboardingRouteLabel,
} from "./onboardingWalkthrough";

type FirstRunOnboardingOverlayProps = {
  visible: boolean;
  step: OnboardingWalkthroughStep | null;
  stepIndex: number;
  stepCount: number;
  isStepRouteActive: boolean;
  onGoToStepRoute: (route: OnboardingRouteName) => void;
  onNext: () => void;
  onSkip: () => void;
};

export default function FirstRunOnboardingOverlay({
  visible,
  step,
  stepIndex,
  stepCount,
  isStepRouteActive,
  onGoToStepRoute,
  onNext,
  onSkip,
}: FirstRunOnboardingOverlayProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible || !step) return null;

  const isLastStep = stepIndex >= stepCount - 1;
  const primaryLabel = isStepRouteActive
    ? isLastStep
      ? "Finish"
      : "Next Tip"
    : `Go to ${onboardingRouteLabel(step.route)}`;

  return (
    <View style={styles.overlay}>
      <View style={styles.backdrop} />
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.progressLabel}>
            Step {stepIndex + 1} of {stepCount}
          </Text>
          <Pressable style={styles.skipButton} onPress={onSkip} accessibilityRole="button">
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.description}>{step.description}</Text>
        <Text style={styles.highlight}>Highlight: {step.highlightLabel}</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (isStepRouteActive) {
              onNext();
              return;
            }
            onGoToStepRoute(step.route);
          }}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          <Text style={styles.primaryLabel}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      justifyContent: "flex-end",
      paddingHorizontal: 12,
      paddingBottom: 14,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    progressLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    skipButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 7,
      paddingHorizontal: 10,
    },
    skipLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    title: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
    },
    description: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    highlight: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    primaryButton: {
      marginTop: 4,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
    },
    primaryLabel: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: "800",
      textTransform: "uppercase",
    },
  });
}
