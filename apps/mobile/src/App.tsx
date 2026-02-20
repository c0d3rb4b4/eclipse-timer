import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ErrorBoundary from "./components/ErrorBoundary";
import RootNavigator from "./navigation/RootNavigator";
import { configureNotificationPresentationHandler } from "./services/notifications";
import { AppStateProvider } from "./state/appState";

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

function AppInner() {
  useEffect(() => {
    configureNotificationPresentationHandler();
  }, []);

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <RootNavigator />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

export default isSentryEnabled ? Sentry.wrap(App) : App;
