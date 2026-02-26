import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ErrorBoundary from "./components/ErrorBoundary";
import RootNavigator from "./navigation/RootNavigator";
import { configureNotificationPresentationHandler } from "./services/notifications";
import { AppStateProvider } from "./state/appState";
import { useAppTheme } from "./theme/useAppTheme";

SplashScreen.preventAutoHideAsync();

const sentryDsn = "__YOUR_SENTRY_DSN__".trim();
const isValidSentryDsn = /^https?:\/\/.+/.test(sentryDsn);
const isSentryEnabled = !__DEV__ && isValidSentryDsn;

if (isSentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
  });
}

function AppContent() {
  useEffect(() => {
    configureNotificationPresentationHandler();
  }, []);

  return <RootNavigator />;
}

function ThemedErrorBoundary({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return <ErrorBoundary colors={colors}>{children}</ErrorBoundary>;
}

function AppInner() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <ThemedErrorBoundary>
          <AppContent />
        </ThemedErrorBoundary>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

function App() {
  return <AppInner />;
}

export default isSentryEnabled ? Sentry.wrap(App) : App;
