import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Sentry from "@sentry/react-native";

type Props = {
  children: ReactNode;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2b2b2b",
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    color: "#b7b7b7",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  debugBox: {
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  debugText: {
    color: "#ff6b6b",
    fontSize: 12,
    fontFamily: "monospace",
  },
  button: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: "#2c3cff",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },
});
