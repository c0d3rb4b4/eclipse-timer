import * as Sentry from "@sentry/react-native";
import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AppThemeColors } from "../theme/colors";

type Props = {
  children: ReactNode;
  colors?: AppThemeColors;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const styles = createStyles(this.props.colors ?? FALLBACK_ERROR_BOUNDARY_COLORS);
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              The app ran into an unexpected error. You can try restarting below.
            </Text>
            {__DEV__ && this.state.error ? (
              <View style={styles.debugBox}>
                <Text style={styles.debugText}>{this.state.error.message}</Text>
              </View>
            ) : null}
            <Pressable
              style={styles.button}
              onPress={this.handleRestart}
              accessibilityRole="button"
              accessibilityLabel="Restart the app"
            >
              <Text style={styles.buttonText}>Restart</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const FALLBACK_ERROR_BOUNDARY_COLORS: AppThemeColors = {
  background: "#0b0b0b",
  surface: "#121212",
  surfaceMuted: "#171717",
  surfaceElevated: "#1b1b1b",
  border: "#2b2b2b",
  borderStrong: "#3a3a3a",
  textPrimary: "#ffffff",
  textSecondary: "#d5d5d5",
  textMuted: "#a8a8a8",
  primary: "#2c3cff",
  primaryMuted: "#1a2056",
  primaryText: "#ffffff",
  inputBackground: "#1b1b1b",
  inputBorder: "#2f2f2f",
  inputPlaceholder: "#6f6f6f",
  dangerBackground: "#351515",
  dangerBorder: "#7b2d2d",
  dangerText: "#ffb8b8",
  overlay: "rgba(0,0,0,0.58)",
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    card: {
      width: "100%",
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 32,
      paddingHorizontal: 20,
      alignItems: "center",
      gap: 12,
    },
    emoji: {
      fontSize: 36,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    message: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    debugBox: {
      width: "100%",
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    debugText: {
      color: colors.dangerText,
      fontSize: 12,
      fontFamily: "monospace",
    },
    button: {
      marginTop: 4,
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    buttonText: {
      color: colors.primaryText,
      fontWeight: "800",
      fontSize: 15,
    },
  });
}
